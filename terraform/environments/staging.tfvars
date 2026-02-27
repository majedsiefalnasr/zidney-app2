# Staging environment configuration
# Usage: terraform apply -var-file="environments/staging.tfvars"

aws_region          = "us-east-1"
environment         = "staging"
registry            = "ghcr.io"
image_name          = "majedsiefalnasr/zidney-app2/mmc-dashboard"
image_tag           = "staging-latest"
api_replicas        = 2
api_min_replicas    = 2
api_max_replicas    = 5
ingress_hostname    = "staging-mmc.dashboard.example.com"
deployment_strategy = "rolling_update"
enable_monitoring   = true
log_retention_days  = 7
backup_enabled      = true

tags = {
  Environment = "staging"
  Team        = "engineering"
  CostCenter  = "platform"
}
