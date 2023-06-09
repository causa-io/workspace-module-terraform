/**
 * The schema for the Terraform configuration.
 */
export type TerraformConfiguration = {
  /**
   * Configuration for Terraform.
   */
  terraform?: {
    /**
     * The Terraform workspace that should be selected prior to performing `plan` and `apply` operations.
     */
    workspace?: string;

    /**
     * The version of Terraform to use.
     * Can be a semver version, or `latest`.
     * The installed version is considered compatible if it is greater than or equal to the configured version, within
     * the same major version.
     */
    version?: string;
  };
};
