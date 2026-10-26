// The PowerShell supervisor joins a kill-on-close Windows Job before starting npm.
// Descendants inherit the Job, including processes created during cancellation.
export function windowsJobCommand(node:string,args:string[],cwd:string){
 const quoted=args.map(value=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"').join(' ');
 const data=Buffer.from(JSON.stringify({node,arguments:quoted,cwd}),'utf8').toString('base64');
 const source=`$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AresJob {
 [StructLayout(LayoutKind.Sequential)] public struct Basic { public long ProcessTime; public long JobTime; public uint Flags; public UIntPtr Min; public UIntPtr Max; public uint Processes; public UIntPtr Affinity; public uint Priority; public uint Scheduling; }
 [StructLayout(LayoutKind.Sequential)] public struct IO { public ulong ReadOps; public ulong WriteOps; public ulong OtherOps; public ulong ReadBytes; public ulong WriteBytes; public ulong OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] public struct Extended { public Basic Basic; public IO IO; public UIntPtr ProcessMemory; public UIntPtr JobMemory; public UIntPtr PeakProcess; public UIntPtr PeakJob; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended info,uint length);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 public static IntPtr Handle;
 public static int Run(string node,string args,string cwd){var info=new System.Diagnostics.ProcessStartInfo(node,args);info.UseShellExecute=false;info.CreateNoWindow=true;info.WorkingDirectory=cwd;info.RedirectStandardOutput=true;info.RedirectStandardError=true;var process=System.Diagnostics.Process.Start(info);var output=process.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());var error=process.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());process.WaitForExit();System.Threading.Tasks.Task.WaitAll(output,error);return process.ExitCode;}
 public static void Start(){Handle=CreateJobObject(IntPtr.Zero,null);var limits=new Extended();limits.Basic.Flags=0x2000;if(Handle==IntPtr.Zero||!SetInformationJobObject(Handle,9,ref limits,(uint)Marshal.SizeOf(typeof(Extended)))||!AssignProcessToJobObject(Handle,GetCurrentProcess()))throw new Exception("No se pudo aislar el árbol de procesos Windows.");}
}
'@
[AresJob]::Start()
$payload=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json
$exitCode=[AresJob]::Run($payload.node,$payload.arguments,$payload.cwd)
[Environment]::Exit($exitCode)
`;
 return Buffer.from(source,'utf16le').toString('base64');
}
