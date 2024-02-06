import { TextDocument } from "vscode-languageserver-textdocument";
import { asyncExec } from "../utils/misc";
import { relative } from "node:path";
import { default as GitURL } from "git-url-parse";

function translateGitToHttps(url: string) {
  const uri = GitURL(url);
  console.log(uri);
  return `https://${uri.source}${uri.pathname}${uri.filepath}`;
}

class GitClient {
  async isInstalled() {
    try {
      await asyncExec("git --version", { encoding: "utf8" });
      console.log("git installed");
      return true;
    } catch (err) {
      console.log("git not installed");
      return false;
    }
  }

  async getCurrentHash() {
    const { stdout } = await asyncExec("git rev-parse HEAD");
    return stdout.trim();
  }

  async getRemotes() {
    const { stdout } = await asyncExec("git remote -v");
    return stdout
      .split("\n")
      .map((e) => {
        const [name, url, type] = e.split(/[\s]+/);
        return {
          name,
          url: url
            ? translateGitToHttps(url?.substring(0, url.length - 4))
            : undefined,
          type: type?.substring(1, type.length - 1),
        };
      })
      .filter((item) => item.type === "fetch" && item.url);
  }

  async getRelativeUrl(file: string) {
    const { stdout } = await asyncExec("git rev-parse --show-toplevel");
    console.log(stdout, file);
    return relative(stdout.trim(), file);
  }
}

export async function getFilePermalink(textDocument: TextDocument) {
  console.log(textDocument.uri);
  const uri = new URL(textDocument.uri);
  const gitClient = new GitClient();
  console.log(
    uri.toString(),
    uri.protocol,
    uri.hostname,
    uri.search,
    uri.host,
    uri.pathname
  );
  if (uri.protocol === "file:") {
    if (await gitClient.isInstalled()) {
      const remotes = await gitClient.getRemotes();
      if (remotes.length) {
        const { url } = remotes?.[1];
        return `${url}/blob/${await gitClient.getCurrentHash()}/${await gitClient.getRelativeUrl(
          uri.pathname
        )}`;
      }
    }
  }
  throw new Error("unsupported file.");
}
