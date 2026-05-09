// Children-slot fallback. The dashboard page itself has no recoverable
// state worth rebuilding (just toast + FAB); render null and let the slots
// composed by the layout drive the page on hard refresh.
export default function Default() {
  return null;
}
