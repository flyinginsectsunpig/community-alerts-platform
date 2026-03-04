output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.pg.fqdn
}

output "redis_hostname" {
  value = azurerm_redis_cache.redis.hostname
}

output "redis_primary_key" {
  value     = azurerm_redis_cache.redis.primary_access_key
  sensitive = true
}

output "servicebus_connection_string" {
  value     = azurerm_servicebus_namespace.sb.default_primary_connection_string
  sensitive = true
}
