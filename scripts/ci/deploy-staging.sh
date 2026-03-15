#!/bin/bash

# T040 (moved from scripts/): Deploy MMC Dashboard to Staging Environment
#
# This script executes infrastructure provisioning to staging Kubernetes cluster
# 
# Prerequisites:
#   - AWS credentials configured (via ~/.aws/credentials or IAM role)
#   - Terraform installed (v1.5.0+)
#   - kubectl configured for staging EKS cluster
#   - TF_STATE_BUCKET environment variable set
#
# Run from: project root ($(pwd) == zidney-app2/)
#
# Usage:
#   chmod +x scripts/ci/deploy-staging.sh
#   ./scripts/ci/deploy-staging.sh

set -euo pipefail

# ────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TERRAFORM_DIR="${PROJECT_ROOT}/terraform"
ENVIRONMENT="staging"
TF_VARS_FILE="${TERRAFORM_DIR}/environments/${ENVIRONMENT}.tfvars"
TF_STATE_BUCKET="${TF_STATE_BUCKET:-zidney-terraform-state}"
TF_STATE_LOCK_TABLE="terraform-state-locks"

# ────────────────────────────────────────────────────────────────────────
# COLOR OUTPUT
# ────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# ────────────────────────────────────────────────────────────────────────
# VALIDATION CHECKS
# ────────────────────────────────────────────────────────────────────────

log_info "Starting staging deployment validation..."

# Check Terraform installed
if ! command -v terraform &> /dev/null; then
  log_error "Terraform not found. Please install Terraform v1.5.0+"
  exit 1
fi
TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
log_success "Terraform ${TERRAFORM_VERSION} found"

# Check kubectl installed
if ! command -v kubectl &> /dev/null; then
  log_error "kubectl not found. Please install kubectl"
  exit 1
fi
log_success "kubectl found"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  log_error "AWS credentials not configured. Run: aws configure"
  exit 1
fi
AWS_ACCOUNT=$(aws sts get-caller-identity | jq -r '.Account')
log_success "AWS credentials valid (Account: ${AWS_ACCOUNT})"

# Check Terraform files exist
if [ ! -f "${TERRAFORM_DIR}/mmc-dashboard-main.tf" ]; then
  log_error "Terraform file not found: ${TERRAFORM_DIR}/mmc-dashboard-main.tf"
  exit 1
fi
log_success "Terraform configuration files found"

# Check tfvars file exists
if [ ! -f "${TF_VARS_FILE}" ]; then
  log_error "Environment vars file not found: ${TF_VARS_FILE}"
  exit 1
fi
log_success "Environment configuration file found"

# Check kubectl context
KUBE_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
if [ "${KUBE_CONTEXT}" = "none" ]; then
  log_warn "No Kubernetes context set. Will be set during deployment."
else
  log_success "Kubernetes context: ${KUBE_CONTEXT}"
fi

# ────────────────────────────────────────────────────────────────────────
# TERRAFORM INITIALIZATION
# ────────────────────────────────────────────────────────────────────────

log_info "Initializing Terraform for ${ENVIRONMENT} environment..."

cd "${TERRAFORM_DIR}"

terraform init \
  -backend-config="bucket=${TF_STATE_BUCKET}" \
  -backend-config="key=mmc-dashboard-${ENVIRONMENT}/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=${TF_STATE_LOCK_TABLE}" \
  -upgrade

log_success "Terraform initialized"

# ────────────────────────────────────────────────────────────────────────
# TERRAFORM PLAN
# ────────────────────────────────────────────────────────────────────────

log_info "Creating Terraform plan for ${ENVIRONMENT}..."

PLAN_FILE="terraform-${ENVIRONMENT}.plan"

terraform plan \
  -var-file="${TF_VARS_FILE}" \
  -out="${PLAN_FILE}" \
  -detailed-exitcode || PLAN_EXIT_CODE=$?

# Exit codes:
# 0 = no changes
# 1 = error
# 2 = changes detected
if [ "${PLAN_EXIT_CODE:-0}" = "1" ]; then
  log_error "Terraform plan failed"
  exit 1
fi

if [ "${PLAN_EXIT_CODE:-0}" = "2" ]; then
  log_info "Infrastructure changes detected - will apply below"
else
  log_info "No infrastructure changes needed"
fi

log_success "Terraform plan created: ${PLAN_FILE}"

# ────────────────────────────────────────────────────────────────────────
# DEPLOYMENT CONFIRMATION
# ────────────────────────────────────────────────────────────────────────

echo ""
log_warn "Review the plan above and confirm deployment"
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Region: us-east-1"
echo "Plan file: ${PLAN_FILE}"
echo ""
read -p "Approve deployment? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  log_warn "Deployment cancelled by user"
  exit 0
fi

# ────────────────────────────────────────────────────────────────────────
# TERRAFORM APPLY
# ────────────────────────────────────────────────────────────────────────

log_info "Applying Terraform configuration..."

terraform apply "${PLAN_FILE}"

log_success "Terraform apply completed"

# ────────────────────────────────────────────────────────────────────────
# POST-DEPLOYMENT VALIDATION
# ────────────────────────────────────────────────────────────────────────

log_info "Validating deployment..."

# Wait for Kubernetes to stabilize
log_info "Waiting for Kubernetes deployment to stabilize (60s)..."
sleep 10

# Get deployment status
DEPLOYMENT_NAME="mmc-dashboard-api"
NAMESPACE="mmc"

kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" 2>/dev/null || {
  log_warn "Namespace or deployment not yet visible, waiting..."
  sleep 30
}

# Check pod status
POD_COUNT=$(kubectl get pods -l app=mmc-dashboard -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l)
if [ "${POD_COUNT}" -gt 0 ]; then
  log_success "Found ${POD_COUNT} pods running"
  kubectl get pods -l app=mmc-dashboard -n "${NAMESPACE}"
else
  log_warn "No pods found yet - deployment may still be initializing"
fi

# Get service endpoint
SERVICE_IP=$(kubectl get service mmc-dashboard-api -n "${NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")
if [ "${SERVICE_IP}" != "pending" ]; then
  log_success "Service endpoint: ${SERVICE_IP}"
else
  log_info "Service endpoint not yet assigned (this is normal, may take a few minutes)"
fi

# Get ingress status
INGRESS_HOST=$(kubectl get ingress mmc-dashboard -n "${NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")
if [ "${INGRESS_HOST}" != "pending" ]; then
  log_success "Ingress endpoint: https://${INGRESS_HOST}"
else
  log_info "Ingress endpoint not yet assigned (DNS may take 5-10 minutes)"
fi

# ────────────────────────────────────────────────────────────────────────
# TERRAFORM OUTPUT
# ────────────────────────────────────────────────────────────────────────

log_info "Terraform outputs:"
terraform output -json | jq '.' || true

# ────────────────────────────────────────────────────────────────────────
# DEPLOYMENT SUMMARY
# ────────────────────────────────────────────────────────────────────────

cat << EOF

${GREEN}✅ Staging Deployment Complete${NC}

Environment: ${ENVIRONMENT}
Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Next Steps:
  1. Wait 5-10 minutes for DNS propagation (ingress endpoint)
  2. Run smoke tests: scripts/ci/run-staging-smoke-tests.sh
  3. Monitor logs: kubectl logs -f deployment/mmc-dashboard-api -n mmc
  4. Scale replicas: kubectl scale deployment mmc-dashboard-api -n mmc --replicas=<N>

To view pod behavior:
  kubectl describe deployment mmc-dashboard-api -n mmc
  kubectl get events -n mmc --sort-by='.lastTimestamp'

To rollback this deployment:
  terraform destroy -var-file="${TF_VARS_FILE}" -auto-approve

EOF

log_success "Staging deployment ready for smoke testing"

# Clean up plan file
rm -f "${PLAN_FILE}"

exit 0
