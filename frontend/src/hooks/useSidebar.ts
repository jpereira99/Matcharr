import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "matcharr-sidebar";

let listeners: Array<() => void> = [];
let collapsed = localStorage.getItem(STORAGE_KEY) === "collapsed";

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return collapsed;
}

export function useSidebar() {
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot);

  const toggle = useCallback(() => {
    collapsed = !collapsed;
    localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
    notify();
  }, []);

  return { collapsed: isCollapsed, toggle };
}
