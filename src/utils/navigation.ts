export function openExtensionPage(hash = ""): void {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/ui/options-page/index.html") + hash,
  })
}
