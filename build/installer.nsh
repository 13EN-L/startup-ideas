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
