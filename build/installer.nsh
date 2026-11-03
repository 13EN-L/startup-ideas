; FocusGarden starts the ActivityWatch copy in resources\activitywatch and
; leaves it running in the tray. Stop it before files are replaced or removed.
; Only processes started from FocusGarden's own folder are stopped; a
; separately installed ActivityWatch is left alone.

!macro stopBundledActivityWatch
  ; $INSTDIR covers custom install folders; the second pattern covers upgrades
  ; where $INSTDIR is not known yet.
  nsExec::ExecToLog `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $$_.Path -like '$INSTDIR\resources\activitywatch\*' -or $$_.Path -like '*\FocusGarden\resources\activitywatch\*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`
  Pop $0
!macroend

!macro customInit
  !insertmacro stopBundledActivityWatch
!macroend

!macro customUnInit
  !insertmacro stopBundledActivityWatch
!macroend

; FocusGarden registers the bundled ActivityWatch to start at sign-in (see
; src/main/activitywatch/autostart.ts). Remove that entry with the app, but
; not on an upgrade, where the new version registers it again anyway.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "FocusGarden ActivityWatch"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "FocusGarden ActivityWatch"
  ${endIf}
!macroend
