; Quillvibe Custom NSIS Installer Hooks
; Refreshes Windows Explorer icon and file-association caches cleanly after install/upgrade/uninstall
!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Preparing Quillvibe Book Writing Studio installation..."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Refreshing Quillvibe application icon and file associations..."
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
