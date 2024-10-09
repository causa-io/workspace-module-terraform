# 🔖 Changelog

## Unreleased

## v0.6.0 (2024-10-09)

Breaking change:

- Use the new `project.externalFiles` configuration when linting Terraform files, instead of `project.additionalDirectories`.
- Do not run `terraform validate` during `cs lint` because it may require additional Terraform configuration.

## v0.5.0 (2024-05-21)

Breaking change:

- Drop support for Node.js 16.

Chore:

- Upgrade dependencies.

## v0.4.0 (2023-10-06)

Breaking changes:

- When the plan file location is not specified in `cs infrastructure prepare`, it now defaults to a `plan.out` file in the project's directory.
- When the prepared plan contains no change, the plan file is removed from the output location.
- The plan file is removed after a successful `cs infrastructure deploy`.

## v0.3.1 (2023-08-01)

Chores:

- Adapt to breaking change in `@causa/workspace-core` (`ProjectDependenciesUpdate`).

## v0.3.0 (2023-07-31)

Features:

- Support the `--destroy` option for the `infrastructure prepare` command.
- Support the `dependencies update` command (`ProjectDependenciesUpdate` function).

## v0.2.0 (2023-06-09)

Features:

- Implement the `validate` and `fmt` method in the `TerraformService`.
- Implement the `ProjectInit` and `ProjectLint` functions for Terraform.
- Check the Terraform version before running commands, through the new `terraform.version` configuration.

## v0.1.0 (2023-05-18)

Features:

- Implement the `TerraformService`.
- Implement the `InfrastructureDeployForTerraform` and `InfrastructurePrepareForTerraform` functions.
