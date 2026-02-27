variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "registry" {
  description = "Container registry URL"
  type        = string
  default     = "ghcr.io"
}

variable "image_name" {
  description = "Docker image name"
  type        = string
  default     = "majedsiefalnasr/zidney-app2/mmc-dashboard"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "api_replicas" {
  description = "Number of API replicas"
  type        = number
  default     = 3

  validation {
    condition     = var.api_replicas >= 1 && var.api_replicas <= 10
    error_message = "API replicas must be between 1 and 10."
  }
}

variable "api_min_replicas" {
  description = "Minimum number of API replicas for autoscaling"
  type        = number
  default     = 2

  validation {
    condition     = var.api_min_replicas >= 1 && var.api_min_replicas <= 5
    error_message = "Minimum replicas must be between 1 and 5."
  }
}

variable "api_max_replicas" {
  description = "Maximum number of API replicas for autoscaling"
  type        = number
  default     = 10

  validation {
    condition     = var.api_max_replicas >= 2 && var.api_max_replicas <= 20
    error_message = "Maximum replicas must be between 2 and 20."
  }
}

variable "ingress_hostname" {
  description = "Hostname for ingress"
  type        = string

  validation {
    condition     = can(regex("^$|^[a-z0-9]([a-z0-9-]*\\.)*[a-z0-9-]*$", var.ingress_hostname))
    error_message = "Ingress hostname must be a valid domain name."
  }
}

variable "deployment_strategy" {
  description = "Deployment strategy (rolling_update or blue_green)"
  type        = string
  default     = "rolling_update"

  validation {
    condition     = contains(["rolling_update", "blue_green"], var.deployment_strategy)
    error_message = "Deployment strategy must be either 'rolling_update' or 'blue_green'."
  }
}

variable "enable_monitoring" {
  description = "Enable Prometheus monitoring"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30

  validation {
    condition     = var.log_retention_days > 0 && var.log_retention_days <= 3653
    error_message = "Log retention days must be between 1 and 3653."
  }
}

variable "backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}
