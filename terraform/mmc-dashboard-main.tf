terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    # Configured via CLI flags during init
    # bucket, key, region passed as backend-config
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "zidney"
      Component   = "mmc-dashboard"
      ManagedBy   = "terraform"
    }
  }
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.mmc.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.mmc.certificate_authority.0.data)
  token                  = data.aws_eks_cluster_auth.mmc.token
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.mmc.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.mmc.certificate_authority.0.data)
    token                  = data.aws_eks_cluster_auth.mmc.token
  }
}

# ────────────────────────────────────────────────────────────────────────
# DATA SOURCES
# ────────────────────────────────────────────────────────────────────────

# Reference existing EKS cluster
data "aws_eks_cluster" "mmc" {
  name = "zidney-mmc-${var.environment}"
}

data "aws_eks_cluster_auth" "mmc" {
  name = data.aws_eks_cluster.mmc.name
}

# Reference existing RDS PostgreSQL instance
data "aws_db_instance" "postgres" {
  db_instance_identifier = "zidney-mmc-${var.environment}"
}

# Reference existing ElastiCache Redis
data "aws_elasticache_cluster" "redis" {
  cluster_id = "zidney-mmc-${var.environment}"
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES NETWORK POLICY
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_network_policy" "mmc_dashboard" {
  metadata {
    name      = "mmc-dashboard"
    namespace = "mmc"
  }

  spec {
    pod_selector {
      match_labels = {
        app = "mmc-dashboard"
      }
    }

    policy_types = ["Ingress", "Egress"]

    # Allow ingress from ingress controller
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "ingress-nginx"
          }
        }
      }
      ports {
        protocol = "TCP"
        port     = "8080"
      }
    }

    # Allow outbound to PostgreSQL
    egress {
      to {
        pod_selector {
          match_expressions {
            key      = "app.kubernetes.io/name"
            operator = "In"
            values   = ["postgres"]
          }
        }
      }
      ports {
        protocol = "TCP"
        port     = "5432"
      }
    }

    # Allow outbound to Redis
    egress {
      to {
        pod_selector {
          match_expressions {
            key      = "app.kubernetes.io/name"
            operator = "In"
            values   = ["redis"]
          }
        }
      }
      ports {
        protocol = "TCP"
        port     = "6379"
      }
    }

    # Allow DNS
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = "kube-system"
          }
        }
      }
      ports {
        protocol = "UDP"
        port     = "53"
      }
    }
  }
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES DEPLOYMENT
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_deployment" "mmc_dashboard_api" {
  metadata {
    name      = "mmc-dashboard-api"
    namespace = "mmc"

    labels = {
      app       = "mmc-dashboard"
      component = "api"
    }
  }

  spec {
    replicas = var.api_replicas

    strategy {
      type = "RollingUpdate"

      rolling_update {
        max_surge       = 1
        max_unavailable = 0
      }
    }

    selector {
      match_labels = {
        app       = "mmc-dashboard"
        component = "api"
      }
    }

    template {
      metadata {
        labels = {
          app       = "mmc-dashboard"
          component = "api"
        }

        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "9090"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.mmc_dashboard.metadata[0].name

        # Init container for migrations
        init_container {
          name  = "db-migrate"
          image = "${var.registry}/${var.image_name}:${var.image_tag}"

          env {
            name  = "DATABASE_URL"
            value = "postgresql://${data.aws_db_instance.postgres.username}:${random_password.db_password.result}@${data.aws_db_instance.postgres.address}:5432/${data.aws_db_instance.postgres.db_name}"
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          command = [
            "sh",
            "-c",
            "npm run db:migrate:latest"
          ]
        }

        container {
          name  = "api"
          image = "${var.registry}/${var.image_name}:${var.image_tag}"

          image_pull_policy = "IfNotPresent"

          ports {
            name           = "http"
            container_port = 8080
            protocol       = "TCP"
          }

          ports {
            name           = "metrics"
            container_port = 9090
            protocol       = "TCP"
          }

          # Environment variables
          env {
            name  = "NODE_ENV"
            value = var.environment
          }

          env {
            name  = "PORT"
            value = "8080"
          }

          env {
            name  = "DATABASE_URL"
            value = "postgresql://${data.aws_db_instance.postgres.username}:${random_password.db_password.result}@${data.aws_db_instance.postgres.address}:5432/${data.aws_db_instance.postgres.db_name}"
          }

          env {
            name  = "REDIS_URL"
            value = "redis://${data.aws_elasticache_cluster.redis.cache_nodes[0].address}:${data.aws_elasticache_cluster.redis.cache_nodes[0].port}"
          }

          env {
            name  = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.mmc_dashboard_secrets.metadata[0].name
                key  = "jwt_secret"
              }
            }
          }

          # Readiness probe
          readiness_probe {
            http_get {
              path   = "/health"
              port   = "http"
              scheme = "HTTP"
            }

            initial_delay_seconds = 10
            timeout_seconds       = 5
            period_seconds        = 10
            success_threshold     = 1
            failure_threshold     = 3
          }

          # Liveness probe
          liveness_probe {
            http_get {
              path   = "/health"
              port   = "http"
              scheme = "HTTP"
            }

            initial_delay_seconds = 30
            timeout_seconds       = 5
            period_seconds        = 30
            success_threshold     = 1
            failure_threshold     = 3
          }

          # Resource limits & requests
          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }

            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }

          # Security context
          security_context {
            run_as_non_root = true
            run_as_user     = 1000

            capabilities {
              drop = ["ALL"]
            }
          }

          # Volume mounts
          volume_mount {
            name       = "config"
            mount_path = "/app/config"
            read_only  = true
          }
        }

        # Volumes
        volume {
          name = "config"

          config_map {
            name = kubernetes_config_map.mmc_dashboard_config.metadata[0].name
          }
        }

        # Pod security
        security_context {
          fs_group = 1000
        }

        # Affinity for high availability
        affinity {
          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100

              pod_affinity_term {
                label_selector {
                  match_expressions {
                    key      = "app"
                    operator = "In"
                    values   = ["mmc-dashboard"]
                  }
                }

                topology_key = "kubernetes.io/hostname"
              }
            }
          }
        }

        # Tolerations
        toleration {
          key      = "mmc-workload"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }
      }
    }
  }

  depends_on = [
    kubernetes_service_account.mmc_dashboard,
    kubernetes_secret.mmc_dashboard_secrets,
    kubernetes_config_map.mmc_dashboard_config,
  ]
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES SERVICE
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_service" "mmc_dashboard_api" {
  metadata {
    name      = "mmc-dashboard-api"
    namespace = "mmc"

    labels = {
      app = "mmc-dashboard"
    }
  }

  spec {
    type = "ClusterIP"

    selector = {
      app       = "mmc-dashboard"
      component = "api"
    }

    port {
      name        = "http"
      port        = 80
      target_port = "http"
      protocol    = "TCP"
    }

    port {
      name        = "metrics"
      port        = 9090
      target_port = "metrics"
      protocol    = "TCP"
    }
  }
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES INGRESS
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_ingress_v1" "mmc_dashboard" {
  metadata {
    name      = "mmc-dashboard"
    namespace = "mmc"

    annotations = {
      "cert-manager.io/cluster-issuer"                   = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect"         = "true"
      "nginx.ingress.kubernetes.io/use-regex"            = "true"
      "nginx.ingress.kubernetes.io/rate-limit"           = "1000"
      "nginx.ingress.kubernetes.io/rate-limit-window"    = "3600"
      "nginx.ingress.kubernetes.io/proxy-body-size"      = "50m"
      "nginx.ingress.kubernetes.io/proxy-connect-timeout" = "30"
      "nginx.ingress.kubernetes.io/proxy-send-timeout"    = "30"
      "nginx.ingress.kubernetes.io/proxy-read-timeout"    = "30"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts = [var.ingress_hostname]
      secret_name = "${var.environment}-mmc-dashboard-tls"
    }

    rule {
      host = var.ingress_hostname

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.mmc_dashboard_api.metadata[0].name
              port {
                name = "http"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_service.mmc_dashboard_api]
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES HORIZONTAL POD AUTOSCALER
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_horizontal_pod_autoscaler_v2" "mmc_dashboard_api" {
  metadata {
    name      = "mmc-dashboard-api"
    namespace = "mmc"
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.mmc_dashboard_api.metadata[0].name
    }

    min_replicas = var.api_min_replicas
    max_replicas = var.api_max_replicas

    metric {
      type = "Resource"

      resource {
        name = "cpu"

        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }

    metric {
      type = "Resource"

      resource {
        name = "memory"

        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.mmc_dashboard_api]
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES SERVICE ACCOUNT
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_service_account" "mmc_dashboard" {
  metadata {
    name      = "mmc-dashboard"
    namespace = "mmc"
  }
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES SECRETS
# ────────────────────────────────────────────────────────────────────────

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "kubernetes_secret" "mmc_dashboard_secrets" {
  metadata {
    name      = "mmc-dashboard-secrets"
    namespace = "mmc"
  }

  data = {
    jwt_secret     = random_password.jwt_secret.result
    db_password    = random_password.db_password.result
    api_key        = random_password.db_password.result
  }

  type = "Opaque"
}

# ────────────────────────────────────────────────────────────────────────
# KUBERNETES CONFIG MAP
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_config_map" "mmc_dashboard_config" {
  metadata {
    name      = "mmc-dashboard-config"
    namespace = "mmc"
  }

  data = {
    "cache.ttl.summary"            = jsonencode(300)   # 5 minutes
    "cache.ttl.affiliates"         = jsonencode(60)    # 1 minute
    "cache.ttl.trends"             = jsonencode(600)   # 10 minutes
    "rate_limit.export"            = jsonencode(100)   # 100/hour
    "rate_limit.general"           = jsonencode(1000)  # 1000/hour
    "rate_limit.window"            = jsonencode(3600)  # 1 hour
    "export.max_rows"              = jsonencode(50000)
    "export.timeout_seconds"       = jsonencode(2)
    "performance.target_latency_ms" = jsonencode(300)
  }
}

# ────────────────────────────────────────────────────────────────────────
# PROMETHEUS SERVICE MONITOR (for metrics collection)
# ────────────────────────────────────────────────────────────────────────

resource "kubernetes_manifest" "mmc_dashboard_service_monitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"

    metadata = {
      name      = "mmc-dashboard"
      namespace = "mmc"

      labels = {
        app = "mmc-dashboard"
      }
    }

    spec = {
      selector = {
        match_labels = {
          app = "mmc-dashboard"
        }
      }

      endpoints = [
        {
          port   = "metrics"
          path   = "/metrics"
          interval = "30s"
        }
      ]
    }
  }
}

# ────────────────────────────────────────────────────────────────────────
# OUTPUTS
# ────────────────────────────────────────────────────────────────────────

output "api_service_endpoint" {
  description = "MMC Dashboard API service endpoint"
  value       = "${kubernetes_service.mmc_dashboard_api.metadata[0].name}.${kubernetes_service.mmc_dashboard_api.metadata[0].namespace}.svc.cluster.local"
}

output "ingress_hostname" {
  description = "Ingress hostname for external access"
  value       = var.ingress_hostname
}

output "database_endpoint" {
  description = "PostgreSQL database endpoint"
  value       = data.aws_db_instance.postgres.address
}

output "redis_endpoint" {
  description = "Redis cache endpoint"
  value       = data.aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "deployment_status" {
  description = "Deployment status"
  value = "✅ MMC Dashboard deployed to ${var.environment} environment"
}
