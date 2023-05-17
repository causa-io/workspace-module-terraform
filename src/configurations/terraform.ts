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
  };
};
