const DEFAULT_URL = "https://hq-three-mauve.vercel.app";
const $ = (id) => document.getElementById(id);

(async () => {
  const cfg = await chrome.storage.local.get(["hqUrl", "token"]);
  $("hqUrl").value = cfg.hqUrl || DEFAULT_URL;
  $("token").value = cfg.token || "";
})();

$("save").onclick = async () => {
  await chrome.storage.local.set({
    hqUrl: ($("hqUrl").value.trim() || DEFAULT_URL).replace(/\/$/, ""),
    token: $("token").value.trim(),
  });
  $("ok").textContent = "Saved ✓";
  setTimeout(() => ($("ok").textContent = ""), 1500);
};
