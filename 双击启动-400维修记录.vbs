' 400 After-Sales Record - hidden launcher
' Double click: start server hidden, wait until ready, then open browser.
Option Explicit
Dim shell, fso, scriptDir, serverBat, http, i, ready

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
serverBat = fso.BuildPath(scriptDir, "run_hidden.bat")

' Start the hidden server batch (window style 0 = hidden, do not wait)
shell.Run """" & serverBat & """", 0, False

' Poll the server until it responds (max ~20 seconds), then open browser
ready = False
For i = 1 To 40
    WScript.Sleep 500
    On Error Resume Next
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.open "GET", "http://localhost:8400/api/heartbeat", False
    http.send
    If Err.Number = 0 And http.Status = 200 Then
        ready = True
    End If
    On Error GoTo 0
    If ready Then Exit For
Next

shell.Run "http://localhost:8400", 1, False
