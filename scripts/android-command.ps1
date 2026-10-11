function Invoke-CheckedAndroidCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Arguments = @()
  )

  & $Command @Arguments | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Commande Android en echec: $Command (code $LASTEXITCODE)"
  }
}
