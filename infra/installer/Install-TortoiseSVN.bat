@echo off
title Install SVN for GMS SVN CLIENT
echo.
echo GMS SVN CLIENT needs svn.exe to checkout and commit.
echo This installs TortoiseSVN (includes svn.exe) - one time on this PC.
echo.
winget install TortoiseSVN.TortoiseSVN --accept-package-agreements --accept-source-agreements
echo.
echo Done. Close and reopen GMS SVN CLIENT, then use SVN Checkout.
pause
