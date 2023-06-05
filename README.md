# `@causa/workspace-terraform` module

This repository contains the source code for the `@causa/workspace-terraform` Causa module. It provides Causa features and implementations of `cs` commands for Terraform infrastructure projects. For more information about the Causa CLI cs, checkout [its repository](https://github.com/causa-io/cli).

# Installation

Add `@causa/workspace-terraform` to your Causa configuration in `causa.modules`.

# Configuration

For all the configuration in your Causa files related to Terraform, look at [the schema for the `TerraformConfiguration`](./src/configurations/terraform.ts).

# Supported project types and commands

This module supports Causa projects with `project.type` set to `infrastructure` and `project.language` set to `terraform`. It implements the following commands:

- `cs infrastructure prepare`: Runs `terraform plan`.
- `cs infrastructure deploy`: Runs `terraform apply` using a previously computed plan.

The dictionary defined in the `infrastructure.variables` configuration can be used to pass input Terraform variables. This dictionary is rendered before being used, meaning it can contain formatting templates referencing other configuration values and secrets.

The `terraform.workspace` configuration determines the Terraform workspace set prior to running any operation. Combined with Causa environments, this can be a powerful feature to manage the infrastructure of several deployment environments.
