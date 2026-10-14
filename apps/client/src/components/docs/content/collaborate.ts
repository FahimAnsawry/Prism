import type { DocPage } from "../docs-types";

export const COLLABORATE_PAGES: DocPage[] = [
  {
    slug: "sharing-and-roles",
    title: "Sharing and roles",
    group: "collaborate",
    minutes: 3,
    lede: "Boards and projects are private until you share them. The owner decides who edits, who only views, and whether a public link exists.",
    blocks: [
      { type: "h2", title: "Roles" },
      {
        type: "matrix",
        head: ["Can", "Owner", "Editor", "Viewer"],
        rows: [
          { label: "Open the board and follow live changes", allowed: [true, true, true] },
          { label: "Draw, edit and delete content", allowed: [true, true, false] },
          { label: "Invite people and manage the share link", allowed: [true, false, false] },
          { label: "Move or delete the board", allowed: [true, false, false] },
        ],
      },
      { type: "h2", title: "Invite people" },
      {
        type: "p",
        text: "Choose Share on a board or a project. Add people by email with a role, or make an invite link. Sharing a project shares every board in it, and a board inside a project always belongs to the project's owner, even when an editor made it.",
      },
      { type: "figure", name: "shareDialog" },
      { type: "h2", title: "Public links and access" },
      {
        type: "p",
        text: "A share link opens the board read-only, with no account needed. Turn it off and the link stops working. Remove someone or lower their role and their open tabs follow at once: a tab that lost access is closed.",
      },
      {
        type: "callout",
        icon: "users",
        title: "AI editors get your role",
        blocks: [
          {
            type: "p",
            text: "An editor connected as you can draw wherever you can edit, and only read where you are a viewer.",
          },
        ],
      },
    ],
  },
  {
    slug: "ask-ai",
    title: "Ask AI requests",
    group: "collaborate",
    minutes: 3,
    lede: "Select something on the board, say what should change, and your connected editor does it. You keep drawing while it works.",
    blocks: [
      { type: "h2", title: "Send a request" },
      {
        type: "p",
        text: "Select the elements the change is about, open Ask AI and describe it the way you would to a teammate. The request joins a queue on the board with your selection attached.",
      },
      { type: "figure", name: "askAi" },
      { type: "h2", title: "Request states" },
      {
        type: "defs",
        rows: [
          {
            term: "Pending",
            badge: true,
            text: "Waiting for an editor. You can still change the prompt.",
          },
          { term: "Paused", badge: true, text: "Held back. Editors skip it until you resume it." },
          { term: "Working", badge: true, text: "An editor claimed it and is making the change." },
          {
            term: "Done",
            badge: true,
            text: "Finished, with the editor's one-line note on what changed.",
          },
          {
            term: "Failed",
            badge: true,
            text: "The editor couldn't do it, and its note says why.",
          },
        ],
      },
      { type: "h2", title: "On the editor's side" },
      {
        type: "p",
        text: "Requests wait until an editor is listening. Start the `watch_edits` prompt and leave it running: it calls `wait_for_edits`, makes each change, finishes it with `complete_edit` and goes back to waiting.",
      },
      { type: "prompt", text: '/mcp__prism__watch_edits "Harbor Gym"' },
    ],
  },
];
