# Production environment configuration
# Usage: terraform apply -var-file="environments/production.tfvars"

aws_region          = "us-east-1"
environment         = "production"
registry            = "ghcr.io"
image_name          = "majedsiefalnasr/zidney-app2/mmc-dashboard"
image_tag           = "production-v1.0.0"
api_replicas        = 5
api_min_replicas    = 5
api_max_replicas    = 20
ingress_hostname    = "mmc.dashboard.example.com"
deployment_strategy = "blue_green"
enable_monitoring   = true
log_retention_days  = 90
backup_enabled      = true

tags = {
  Environment = "production"
  Team        = "engineering"
  CostCenter  = "revenue"
  Compliance  = "critical"
}
