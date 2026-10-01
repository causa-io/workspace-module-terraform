# `@causa/workspace-terraform` module

This repository contains the source code for the `@causa/workspace-terraform` Causa module. It provides Causa features and implementations of `cs` commands for Terraform infrastructure projects. For more information about the Causa CLI `cs`, checkout [its repository](https://github.com/causa-io/cli).

## ➕ Requirements

The Causa Terraform module requires [Terraform](https://www.terraform.io/) to be installed.

## 🎉 Installation

Add `@causa/workspace-terraform` to your Causa configuration in `causa.modules`.

## 🔧 Configuration

For all the configuration in your Causa files related to Terraform, look at [the schema for the `TerraformConfiguration`](./src/configurations/terraform.ts).

## ✨ Supported project types and commands

This module supports Causa projects with `project.type` set to `infrastructure` and `project.language` set to `terraform`.

### Infrastructure commands

- `cs infrastructure prepare`: Runs `terraform plan`.
- `cs infrastructure deploy`: Runs `terraform apply` using a previously computed plan.

The dictionary defined in the `infrastructure.variables` configuration can be used to pass input Terraform variables. This dictionary is rendered before being used, meaning it can contain formatting templates referencing other configuration values and secrets.

The `terraform.workspace` configuration determines the Terraform workspace set prior to running any operation. Combined with Causa environments, this can be a powerful feature to manage the infrastructure of several deployment environments.

### Project commands

The Terraform module also supports some of the project-level commands, namely:

- `cs init`: Runs `terraform init`.
- `cs lint`: Runs `terraform fmt`. The format operation is run with the `-check` argument, such that it only lints the code without fixing it. This operation supports the `project.externalFiles` configuration, by linting all Terraform files matching the glob patterns.
- `cs dependencies update`: Runs `terraform init` with the `-upgrade` option, allowing the update of dependencies and the lock file.

## 🕸️ Architecture graph

This module contributes to the architecture graph extracted by `cs graph extract` (see the core module). The `TerraformProjectsFact` reads the Terraform configuration applied by each infrastructure project written in Terraform: the project directory is the root module, from which local module inclusions (`source = "../some/directory"`) are followed. For each project, it lists the modules, and their `module` and `resource` blocks. Modules supporting Terraform code (e.g. for a cloud provider) read the blocks from this fact to mirror the resources they create.
