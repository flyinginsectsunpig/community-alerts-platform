terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "rg" {
  name     = "community-alerts-rg"
  location = var.location
}

# ── Container Registry ────────────────────────────────────────────────────────
resource "azurerm_container_registry" "acr" {
  name                = "communityalertsacr"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = true
}

# ── Postgres ──────────────────────────────────────────────────────────────────
resource "azurerm_postgresql_flexible_server" "pg" {
  name                   = "community-alerts-pg"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = var.db_username
  administrator_password = var.db_password
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  zone                   = "1"
}

resource "azurerm_postgresql_flexible_server_database" "java_db" {
  name      = "communityalertsdb"
  server_id = azurerm_postgresql_flexible_server.pg.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

resource "azurerm_postgresql_flexible_server_database" "notifications_db" {
  name      = "notifications"
  server_id = azurerm_postgresql_flexible_server.pg.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# ── Redis ─────────────────────────────────────────────────────────────────────
resource "azurerm_redis_cache" "redis" {
  name                = "community-alerts-redis"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  capacity            = 0
  family              = "C"
  sku_name            = "Basic"
  enable_non_ssl_port = false
}

# ── Service Bus (Alternative to RabbitMQ in Azure) / Or keep Containerized RabbitMQ
# For this example, we'll provision Azure Service Bus to replace RabbitMQ natively,
# or if preferred, a managed queue. We'll use Azure Service Bus to align with cloud-native.
resource "azurerm_servicebus_namespace" "sb" {
  name                = "community-alerts-sb"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Basic"
}

resource "azurerm_servicebus_queue" "sb_queue" {
  name         = "suburb-alerts"
  namespace_id = azurerm_servicebus_namespace.sb.id
}

# ── Container Apps Environment ────────────────────────────────────────────────
resource "azurerm_log_analytics_workspace" "law" {
  name                = "community-alerts-law"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "env" {
  name                       = "community-alerts-env"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
}
