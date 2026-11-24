# Variáveis preenchidas pelo Qwiklabs ao provisionar o projeto do aluno (project_0).
variable "gcp_project_id" {
  type        = string
  description = "ID do projeto sandbox do lab."
}

variable "gcp_region" {
  type        = string
  description = "Região padrão atribuída ao lab."
}

variable "gcp_zone" {
  type        = string
  description = "Zona padrão atribuída ao lab."
}

variable "service_account_key_file" {
  type        = string
  description = "Arquivo de chave da conta de serviço usada pelo Qwiklabs."
}
