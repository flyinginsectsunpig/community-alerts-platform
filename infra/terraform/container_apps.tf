locals {
  registry_secret = [{
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }]
}

# ---------------------------------------------------------------------------
# Python ML service — internal-only ingress; reachable solely from the
# environment (the Java API proxies it), never from the public internet.
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "ml_service" {
  name                         = "${local.prefix}-ml"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = local.tags

  registry {
    server               = local.registry
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  dynamic "secret" {
    for_each = concat(local.registry_secret, [
      { name = "database-url", value = var.database_url },
      { name = "redis-password", value = var.redis_password },
      { name = "rabbitmq-username", value = var.rabbitmq_username },
      { name = "rabbitmq-password", value = var.rabbitmq_password },
    ])
    content {
      name  = secret.value.name
      value = secret.value.value
    }
  }

  ingress {
    external_enabled = false
    target_port      = 8000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "ml-service"
      image  = "${local.registry}/community-alerts/ml-service:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "REDIS_PASSWORD"
        secret_name = "redis-password"
      }
      env {
        name        = "RABBITMQ_USERNAME"
        secret_name = "rabbitmq-username"
      }
      env {
        name        = "RABBITMQ_PASSWORD"
        secret_name = "rabbitmq-password"
      }
      dynamic "env" {
        for_each = merge(local.redis_env, local.rabbit_env)
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Java alerts API — the single public API surface.
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "alerts_api" {
  name                         = "${local.prefix}-api"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = local.tags

  registry {
    server               = local.registry
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  dynamic "secret" {
    for_each = concat(local.registry_secret, [
      { name = "database-jdbc-url", value = var.database_jdbc_url },
      { name = "database-user", value = var.database_user },
      { name = "database-password", value = var.database_password },
      { name = "redis-password", value = var.redis_password },
      { name = "rabbitmq-username", value = var.rabbitmq_username },
      { name = "rabbitmq-password", value = var.rabbitmq_password },
    ])
    content {
      name  = secret.value.name
      value = secret.value.value
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 5

    container {
      name   = "alerts-api"
      image  = "${local.registry}/community-alerts/alerts-api:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name        = "DATABASE_JDBC_URL"
        secret_name = "database-jdbc-url"
      }
      env {
        name        = "DATABASE_USER"
        secret_name = "database-user"
      }
      env {
        name        = "DATABASE_PASSWORD"
        secret_name = "database-password"
      }
      env {
        name        = "REDIS_PASSWORD"
        secret_name = "redis-password"
      }
      env {
        name        = "RABBITMQ_USERNAME"
        secret_name = "rabbitmq-username"
      }
      env {
        name        = "RABBITMQ_PASSWORD"
        secret_name = "rabbitmq-password"
      }
      env {
        name  = "ML_SERVICE_URL"
        value = "https://${azurerm_container_app.ml_service.ingress[0].fqdn}"
      }
      env {
        name  = "CORS_ALLOWED_ORIGINS"
        value = "https://${local.prefix}-web.${azurerm_container_app_environment.main.default_domain}"
      }
      dynamic "env" {
        for_each = merge(local.redis_env, local.rabbit_env)
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
}

# ---------------------------------------------------------------------------
# .NET alert processor — headless background worker, no ingress.
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "alert_processor" {
  name                         = "${local.prefix}-worker"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = local.tags

  registry {
    server               = local.registry
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  dynamic "secret" {
    for_each = concat(local.registry_secret, [
      { name = "postgres-connection-string", value = var.postgres_connection_string },
      { name = "redis-password", value = var.redis_password },
      { name = "rabbitmq-username", value = var.rabbitmq_username },
      { name = "rabbitmq-password", value = var.rabbitmq_password },
      { name = "notification-webhook-url", value = var.notification_webhook_url },
    ])
    content {
      name  = secret.value.name
      value = secret.value.value
    }
  }

  template {
    min_replicas = 1
    max_replicas = 2

    container {
      name   = "alert-processor"
      image  = "${local.registry}/community-alerts/alert-processor:${var.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name        = "POSTGRES_CONNECTION_STRING"
        secret_name = "postgres-connection-string"
      }
      env {
        name        = "REDIS_PASSWORD"
        secret_name = "redis-password"
      }
      env {
        name        = "RABBITMQ_USERNAME"
        secret_name = "rabbitmq-username"
      }
      env {
        name        = "RABBITMQ_PASSWORD"
        secret_name = "rabbitmq-password"
      }
      env {
        name        = "NOTIFICATION_WEBHOOK_URL"
        secret_name = "notification-webhook-url"
      }
      dynamic "env" {
        for_each = merge(local.redis_env, local.rabbit_env)
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Next.js web dashboard — public. NEXT_PUBLIC_API_URL is baked at image
# build time; build the web image with the alerts API FQDN (see CI notes).
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "web" {
  name                         = "${local.prefix}-web"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = local.tags

  registry {
    server               = local.registry
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  dynamic "secret" {
    for_each = local.registry_secret
    content {
      name  = secret.value.name
      value = secret.value.value
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "web"
      image  = "${local.registry}/community-alerts/web:${var.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }
}
