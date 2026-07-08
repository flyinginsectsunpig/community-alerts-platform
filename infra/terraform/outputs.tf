output "web_url" {
  description = "Public URL of the dashboard"
  value       = "https://${azurerm_container_app.web.ingress[0].fqdn}"
}

output "api_url" {
  description = "Public URL of the alerts API"
  value       = "https://${azurerm_container_app.alerts_api.ingress[0].fqdn}"
}

output "ml_internal_fqdn" {
  description = "Environment-internal FQDN of the ML service"
  value       = azurerm_container_app.ml_service.ingress[0].fqdn
}

output "acr_login_server" {
  description = "Push images here (docker tag <img> <login_server>/community-alerts/<img>:<tag>)"
  value       = azurerm_container_registry.main.login_server
}
