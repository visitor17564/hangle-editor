using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

[assembly: AssemblyTitle("Hangle Editor")]
[assembly: AssemblyProduct("Hangle Editor")]
[assembly: AssemblyDescription("Open HWP and HWPX documents in Obsidian")]

internal static class HangleEditorLauncher {
    [STAThread]
    private static int Main(string[] args) {
        string ticketFile = null;
        try {
            if (args.Length != 1) throw new ArgumentException("Choose one HWP or HWPX file.");
            string file = Path.GetFullPath(args[0]);
            string extension = Path.GetExtension(file);
            if ((!extension.Equals(".hwpx", StringComparison.OrdinalIgnoreCase) &&
                 !extension.Equals(".hwp", StringComparison.OrdinalIgnoreCase)) || !File.Exists(file))
                throw new IOException("Choose an existing HWP or HWPX file.");

            string home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HangleEditor");
            string[] settings = File.ReadAllLines(Path.Combine(home, "explorer.config"), Encoding.UTF8);
            if (settings.Length != 2 || String.IsNullOrWhiteSpace(settings[0]) || !File.Exists(settings[1]))
                throw new IOException("Register Hangle Editor again to select the Obsidian installation and vault.");

            string queue = Directory.CreateDirectory(Path.Combine(home, "requests")).FullName;
            foreach (string pending in Directory.EnumerateFiles(queue, "*.txt")) {
                Guid id;
                if (Guid.TryParseExact(Path.GetFileNameWithoutExtension(pending), "N", out id) &&
                    File.GetLastWriteTimeUtc(pending) < DateTime.UtcNow.AddDays(-1)) {
                    try { File.Delete(pending); } catch (IOException) { } catch (UnauthorizedAccessException) { }
                }
            }
            string ticket = Guid.NewGuid().ToString("N");
            ticketFile = Path.Combine(queue, ticket + ".txt");
            using (FileStream stream = new FileStream(ticketFile, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            using (StreamWriter writer = new StreamWriter(stream, new UTF8Encoding(false))) writer.Write(file);

            string uri = "obsidian://hangle-editor?vault=" + Uri.EscapeDataString(settings[0]) + "&ticket=" + ticket;
            // Current Windows installations forward URIs to the running vault via Obsidian.com.
            string forwarder = Path.ChangeExtension(settings[1], ".com");
            if (File.Exists(forwarder)) {
                Process.Start(new ProcessStartInfo(forwarder, "\"" + uri + "\"") {
                    UseShellExecute = false, CreateNoWindow = true
                });
            } else {
                Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
            }
            return 0;
        } catch (Exception error) {
            if (ticketFile != null) { try { File.Delete(ticketFile); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
            MessageBox.Show(error.Message, "Hangle Editor", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }
    }
}
