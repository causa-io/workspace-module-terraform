# 🔖 Changelog

## Unreleased

Features:

- Support the `--destroy` option for the `infrastructure prepare` command.

## v0.2.0 (2023-06-09)

Features:

- Implement the `validate` and `fmt` method in the `TerraformService`.
- Implement the `ProjectInit` and `ProjectLint` functions for Terraform.
- Check the Terraform version before running commands, through the new `terraform.version` configuration.

## v0.1.0 (2023-05-18)

Features:

- Implement the `TerraformService`.
- Implement the `InfrastructureDeployForTerraform` and `InfrastructurePrepareForTerraform` functions.
