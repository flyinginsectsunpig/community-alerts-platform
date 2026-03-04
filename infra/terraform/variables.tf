variable "location" {
  description = "Azure region to deploy resources"
  type        = string
  default     = "southafricanorth"
}

variable "db_username" {
  description = "Postgres admin username"
  type        = string
  default     = "pgadmin"
}

variable "db_password" {
  description = "Postgres admin password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT Secret Key for Java API"
  type        = string
  sensitive   = true
}
