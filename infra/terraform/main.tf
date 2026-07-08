locals {
  prefix = "${var.project_name}-${var.environment}"

  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }

  registry = "${azurerm_container_registry.main.login_server}"

  # Environment variables shared by every backend service.
  redis_env = {
    REDIS_HOST = var.redis_host
    REDIS_PORT = tostring(var.redis_port)
    REDIS_SSL  = "true"
  }

  rabbit_env = {
    RABBITMQ_HOST  = var.rabbitmq_host
    RABBITMQ_PORT  = tostring(var.rabbitmq_port)
    RABBITMQ_VHOST = var.rabbitmq_vhost
    RABBITMQ_SSL   = "true"
  }
}

resource "azurerm_resource_group" "main" {
  name     = "${local.prefix}-rg"
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.prefix}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_container_registry" "main" {
  name                = replace("${local.prefix}acr", "-", "")
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "${local.prefix}-env"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags
}
