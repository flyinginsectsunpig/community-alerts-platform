variable "project_name" {
  description = "Base name for all Azure resources"
  type        = string
  default     = "community-alerts"
}

variable "environment" {
  description = "Deployment environment (prod, staging, ...)"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "uksouth"
}

variable "image_tag" {
  description = "Container image tag to deploy (set by CI per release)"
  type        = string
  default     = "latest"
}

variable "web_api_url" {
  description = "Public API URL baked into the web image at build time (informational; must match the api app's FQDN)"
  type        = string
  default     = ""
}

# --- Neon PostgreSQL ---

variable "database_jdbc_url" {
  description = "JDBC URL for Neon PostgreSQL (Java API)"
  type        = string
  sensitive   = true
}

variable "database_user" {
  type      = string
  sensitive = true
}

variable "database_password" {
  type      = string
  sensitive = true
}

variable "database_url" {
  description = "libpq URL for Neon PostgreSQL (Python ML service)"
  type        = string
  sensitive   = true
}

variable "postgres_connection_string" {
  description = "Npgsql connection string for Neon PostgreSQL (.NET worker)"
  type        = string
  sensitive   = true
}

# --- Upstash Redis (TCP + TLS) ---

variable "redis_host" {
  type = string
}

variable "redis_port" {
  type    = number
  default = 6379
}

variable "redis_password" {
  type      = string
  sensitive = true
}

# --- CloudAMQP LavinMQ (AMQPS) ---

variable "rabbitmq_host" {
  type = string
}

variable "rabbitmq_port" {
  type    = number
  default = 5671
}

variable "rabbitmq_username" {
  type      = string
  sensitive = true
}

variable "rabbitmq_password" {
  type      = string
  sensitive = true
}

variable "rabbitmq_vhost" {
  type = string
}

# --- Optional integrations ---

variable "notification_webhook_url" {
  description = "Optional webhook (e.g. Slack) for escalation notifications"
  type        = string
  sensitive   = true
  default     = ""
}
