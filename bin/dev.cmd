@echo off

node --loader ts-node/esm --experimental-specifier-resolution=node --no-warnings=ExperimentalWarning "%~dp0\dev" %*
