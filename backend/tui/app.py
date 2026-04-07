from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, RichLog, Static
from textual.containers import Container, Vertical
from textual import work
from backend.core.queue import tui_log_queue
import asyncio

SPLASH = """\
[bold cyan]
 ███╗   ██╗ ██████╗ ██████╗ ███████╗███╗   ███╗██╗███╗   ██╗██████╗ 
 ████╗  ██║██╔═══██╗██╔══██╗██╔════╝████╗ ████║██║████╗  ██║██╔══██╗
 ██╔██╗ ██║██║   ██║██║  ██║█████╗  ██╔████╔██║██║██╔██╗ ██║██║  ██║
 ██║╚██╗██║██║   ██║██║  ██║██╔══╝  ██║╚██╔╝██║██║██║╚██╗██║██║  ██║
 ██║ ╚████║╚██████╔╝██████╔╝███████╗██║ ╚═╝ ██║██║██║ ╚████║██████╔╝
 ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ 
[/bold cyan]
[dim cyan]                  Graph Memory for Multi-Agent AI Swarms[/dim cyan]
[dim]                   ─────────────────────────────────────[/dim]
"""

BOOT_SEQUENCE = [
    ("  [dim]▸[/dim] Initializing vector memory layer...",     "[bold green]  ✓[/bold green] [green]ChromaDB online[/green]"),
    ("  [dim]▸[/dim] Connecting to MongoDB node store...",     "[bold green]  ✓[/bold green] [green]MongoDB connected[/green]"),
    ("  [dim]▸[/dim] Binding WebSocket broadcast bus...",      "[bold green]  ✓[/bold green] [green]WebSocket :8000/ws ready[/green]"),
    ("  [dim]▸[/dim] Spawning .brain filesystem watcher...",   "[bold green]  ✓[/bold green] [green]Watchdog observing .brain/[/green]"),
    ("  [dim]▸[/dim] Loading Gemini agent swarm engine...",    "[bold green]  ✓[/bold green] [green]Swarm engine armed[/green]"),
]

class NodeMindTUI(App):
    BINDINGS = [("ctrl+c", "quit", "Quit Daemon")]

    CSS = """
    Screen {
        background: #060809;
    }

    #splash {
        height: auto;
        padding: 1 2;
        content-align: center middle;
    }

    #divider {
        height: 1;
        color: #1a2a1a;
        padding: 0 2;
    }

    #main-log {
        height: 1fr;
        border: solid #0f1117;
        background: #060809;
        color: #9ca3af;
        padding: 0 1;
    }

    Header {
        background: #060809;
        color: #6366f1;
        border-bottom: solid #0f1117;
    }

    Footer {
        background: #060809;
        color: #374151;
        border-top: solid #0f1117;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Vertical():
            yield Static(SPLASH, id="splash")
            yield Static("─" * 80, id="divider")
            self.log_widget = RichLog(id="main-log", highlight=True, markup=True)
            yield self.log_widget
        yield Footer()

    def on_mount(self) -> None:
        self.title = "NodeMind"
        self.sub_title = "Swarm Intelligence Daemon  •  v0.1.0"
        self.run_boot_sequence()

    @work(exclusive=True)
    async def run_boot_sequence(self) -> None:
        await asyncio.sleep(0.3)
        self.log_widget.write("")
        self.log_widget.write("[bold]  Booting services...[/bold]")
        self.log_widget.write("")

        for pending, done in BOOT_SEQUENCE:
            self.log_widget.write(pending)
            await asyncio.sleep(0.18)
            # Overwrite isn't available in RichLog — append done status instead
            self.log_widget.write(done)
            await asyncio.sleep(0.08)

        self.log_widget.write("")
        self.log_widget.write(
            "[bold green]  ✦ NodeMind Daemon online.[/bold green]  "
            "[dim]Visualizer → [/dim][cyan]http://localhost:3000[/cyan]"
        )
        self.log_widget.write(
            "  [dim]Send a prompt via POST[/dim] [cyan]http://localhost:8000/api/prompt[/cyan]"
        )
        self.log_widget.write("")
        self.log_widget.write("[dim]  ─────────────────────────── Agent Feed ───────────────────────────[/dim]")
        self.log_widget.write("")

        # Start polling the thread-safe queue for agent log output
        self.set_interval(0.5, self.check_logs)

    def check_logs(self) -> None:
        while not tui_log_queue.empty():
            msg = tui_log_queue.get()
            self.log_widget.write(msg)
