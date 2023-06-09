/**
 * An error thrown when the installed Terraform version is incompatible with the required version set in the
 * configuration.
 */
export class IncompatibleTerraformVersionError extends Error {
  constructor(
    readonly installedVersion: string,
    readonly requiredVersion: string,
  ) {
    super(
      `Installed Terraform version ${installedVersion} is incompatible with required version ${requiredVersion}.`,
    );
  }
}
