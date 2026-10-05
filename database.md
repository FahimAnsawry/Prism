# Prism: Projects and Boards Database Design

Implemented in `apps/server/prisma/schema.prisma` and applied by the migration `20261005041958_projects_boards_elements`.

It adds three tables to the existing Better Auth tables (`user`, `account`, `session`, `verification`):

- **project**: a folder of boards (dashboard card: name, description, board count, "edited 2h ago", first three board tiles).
- **board**: one whiteboard. It can sit inside a project or stand alone, since the dashboard lists both.
- **element**: one row per thing drawn on a board (tools.md §7).

---

## 1. Tables

### `project`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | String | yes | `uuid()` | Primary key |
| `ownerId` | String | yes | | FK → `user.id`. The user who created it |
| `name` | String | yes | `"Untitled project"` | Shown on the dashboard card |
| `description` | String | no | | One-line subtitle on the card |
| `editedAt` | DateTime | yes | `now()` | Last change to the project **or any of its boards**. Drives "edited 2h ago" and dashboard sorting |
| `archivedAt` | DateTime | no | | Set = in the trash. Hides the project and its boards; clearing it restores them |
| `createdAt` | DateTime | yes | `now()` | |
| `updatedAt` | DateTime | yes | `@updatedAt` | Row changed (Prisma sets it) |

Derived, not stored: **board count** = `_count.boards` (filtered to `archivedAt: null`). **Tiles** = the three most recently edited boards' `thumbnailKey`.

### `board`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | String | yes | `uuid()` | Primary key; also the room id for Socket.IO and the `/board/$id` URL |
| `ownerId` | String | yes | | FK → `user.id`. Kept even for boards in a project so "my boards" is one query; must equal `project.ownerId` when `projectId` is set (checked in app code) |
| `projectId` | String | no | | FK → `project.id`. `null` = standalone board |
| `name` | String | yes | `"Untitled board"` | Renamed from the top bar (tools.md §5) |
| `description` | String | no | | Card subtitle |
| `thumbnailKey` | String | no | | S3 object key of a small PNG preview, rendered by the client with the PNG export (tools.md §2) and uploaded after edits settle. Same pattern as `user.imageKey` |
| `editedAt` | DateTime | yes | `now()` | Last content change (rename or any element change). Bumped at most about once a minute per board, together with the parent `project.editedAt` |
| `archivedAt` | DateTime | no | | Soft delete / trash |
| `createdAt` | DateTime | yes | `now()` | |
| `updatedAt` | DateTime | yes | `@updatedAt` | |

Derived, not stored: **item count** = `_count.elements` (filtered to `deletedAt: null`).

### `element`

Mirrors `BaseElement` in tools.md §7. Fields shared by every element type are real columns; type-specific data goes in `props`.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `boardId` | String | yes | | FK → `board.id`. Part of the primary key |
| `id` | String | yes | | `crypto.randomUUID()`, made by the client (or by the server for MCP `create_elements`). Part of the primary key |
| `type` | `ElementType` enum | yes | | `text`, `sticky`, `list`, `rect`, `ellipse`, `diamond`, `line`, `arrow`, `freehand`, `emoji`, `image`, `svg`, `chart`, `frame` |
| `x` | Float | yes | | World coordinates |
| `y` | Float | yes | | |
| `width` | Float | yes | | |
| `height` | Float | yes | | |
| `rotation` | Float | yes | `0` | Degrees |
| `z` | Float | yes | | Layer order. Float, so "bring forward" can drop an element between two others (e.g. 2.5) without renumbering the board |
| `stroke` | String | yes | | Color |
| `fill` | String | no | | `null` = no fill |
| `strokeWidth` | Float | yes | | |
| `strokeStyle` | `StrokeStyle` enum | yes | `solid` | `solid`, `dashed`, `dotted` |
| `sketch` | Boolean | yes | `false` | Hand-drawn look |
| `opacity` | Float | yes | `1` | 0–1 |
| `groupId` | String | no | | Elements with the same value are one group (`Ctrl+G`) |
| `locked` | Boolean | yes | `false` | |
| `role` | String | no | | Wireframe meaning: `"button"`, `"input"`, `"card"`, … |
| `props` | Json | yes | `{}` | Type-specific data, validated by a Zod union in `@prism/shared` (see below) |
| `updatedBy` | `Author` enum | yes | | `user` or `ai_agent` |
| `version` | Int | yes | `1` | Sync conflict check: the higher version wins |
| `deletedAt` | DateTime | no | | Tombstone. A deleted element keeps its row so a late, lower-version update can't bring it back |
| `createdAt` | DateTime | yes | `now()` | |
| `updatedAt` | DateTime | yes | `@updatedAt` | |

What goes in `props`, per type (from tools.md §1 and §3):

| Type | `props` |
|------|---------|
| `text`, `sticky` | `text`, `font` (`sans` / `caveat` / `mono`), `fontSize`, `align` |
| `list` | `items: {text, indent}[]`, `font`, `fontSize`, `align` |
| `line`, `arrow` | `points`, and for arrows `startBinding` / `endBinding` (element ids) |
| `freehand` | `points` |
| `emoji` | `emoji` |
| `image`, `svg` | `key` (S3 object key), natural size / `viewBox` |
| `chart` | `chartType` (`bar` / `line` / `pie` / `donut`), `data` |
| `frame` | `name` |

---

## 2. Relationships

| From | To | Kind | onDelete | Why |
|------|----|------|----------|-----|
| `user` | `project` | one-to-many (`ownerId`) | Cascade | Deleting an account removes its work |
| `user` | `board` | one-to-many (`ownerId`) | Cascade | Same |
| `project` | `board` | one-to-many, optional (`projectId`) | Cascade | Deleting a project deletes its boards. The normal UI path is archive (`archivedAt`) first, so a hard delete only happens when the trash is emptied. Use `SetNull` instead if boards should survive as standalone boards |
| `board` | `element` | one-to-many (`boardId`) | Cascade | Elements have no meaning without their board |

`User` needs two back-relation fields: `projects Project[]` and `boards Board[]`.

---

## 3. How elements are stored: one row per element (recommended)

| | **`element` table, one row per element** | **One `elements Json` column on `board`** |
|---|---|---|
| Sync write | One guarded `UPDATE … WHERE boardId = ? AND id = ? AND version < ?`. The database applies "higher version wins" for you | Read the whole JSON, merge, write it back. Needs a row lock, or two users editing different elements overwrite each other |
| Write size | Only the changed element | The whole board on every drag or keystroke (Postgres rewrites the full value, TOAST churn on big boards) |
| Concurrency | Edits to different elements never conflict | Every edit to the board fights for the same row |
| MCP tools | `update_elements` / `delete_elements` by id map directly to rows | Must parse and rewrite the blob |
| Item count, queries | `_count`, or filter by `type` / `role` | Needs JSON functions |
| Load a board | `SELECT … WHERE boardId = ?` (served by the primary key) | One row read, slightly simpler |
| Board copy / export | Copy rows | Copy one value |

How a sync event maps to the table:

- **`element:create`** → `INSERT`. If `(boardId, id)` already exists, ignore it (the client retried).
- **`element:update {id, version, changes}`** → `updateMany` with `where: { boardId, id, version: { lt: version } }`. If 0 rows change, the incoming version is stale: send the stored element back to that client.
- **`element:delete {id, version}`** → the same guarded update, setting `deletedAt` and `version`.
- Tombstones (`deletedAt` set) can be purged by a cleanup job after a safe window, such as 30 days.

Later, when traffic grows: keep each open board's elements in memory on the server (per Socket.IO room) and flush changed rows in batches every second or so. The table stays the same.

---

## 4. Prisma draft

This is what `schema.prisma` now contains.

```prisma
// ── Workspace: projects, boards and board elements ────────────────────────

enum ElementType {
  text
  sticky
  list
  rect
  ellipse
  diamond
  line
  arrow
  freehand
  emoji
  image
  svg
  chart
  frame
}

enum StrokeStyle {
  solid
  dashed
  dotted
}

// Who made the last change to an element.
enum Author {
  user
  ai_agent
}

// A folder of boards on the dashboard.
model Project {
  id          String    @id @default(uuid())
  ownerId     String
  owner       User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  name        String    @default("Untitled project")
  description String?
  // Last change to the project or any of its boards ("edited 2h ago").
  editedAt    DateTime  @default(now())
  // Set = in the trash; hides the project and its boards.
  archivedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  boards Board[]

  @@index([ownerId, editedAt(sort: Desc)])
  @@map("project")
}

// One whiteboard. projectId = null means a standalone board.
model Board {
  id           String    @id @default(uuid())
  ownerId      String
  owner        User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  projectId    String?
  project      Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name         String    @default("Untitled board")
  description  String?
  // S3 object key of the PNG preview shown on dashboard cards.
  thumbnailKey String?
  // Last content change (rename or any element change).
  editedAt     DateTime  @default(now())
  archivedAt   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  elements Element[]

  @@index([ownerId, editedAt(sort: Desc)])
  @@index([projectId, editedAt(sort: Desc)])
  @@map("board")
}

// One drawn item (tools.md §7). Shared fields are columns; type-specific
// data (text, points, bindings, chart data, S3 key, ...) lives in props.
model Element {
  boardId     String
  board       Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  // crypto.randomUUID(), made by the client or by the MCP server.
  id          String
  type        ElementType
  x           Float
  y           Float
  width       Float
  height      Float
  rotation    Float       @default(0)
  // Float so an element can be placed between two layers without renumbering.
  z           Float
  stroke      String
  fill        String?
  strokeWidth Float
  strokeStyle StrokeStyle @default(solid)
  sketch      Boolean     @default(false)
  opacity     Float       @default(1)
  groupId     String?
  locked      Boolean     @default(false)
  role        String?
  props       Json        @default("{}")
  updatedBy   Author
  // Sync conflict check: the higher version wins.
  version     Int         @default(1)
  // Tombstone, so a stale update can't bring a deleted element back.
  deletedAt   DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@id([boardId, id])
  @@map("element")
}

// Add to model User:
//   projects Project[]
//   boards   Board[]
```

---

## 5. Indexes

| Index | Serves |
|-------|--------|
| `project (ownerId, editedAt DESC)` | Dashboard "Projects" filter: my projects, newest first |
| `board (ownerId, editedAt DESC)` | Dashboard "Boards" and "All" filters: my boards (and standalone boards via `projectId IS NULL`), newest first |
| `board (projectId, editedAt DESC)` | A project's board list, the board count, and the first three tiles on its card |
| `element` primary key `(boardId, id)` | Loading a whole board (`WHERE boardId = ?`) and every guarded sync update by id. No extra index needed |

Why `(boardId, id)` as the element key instead of `id` alone: every write is scoped to its board, so a client can't touch an element on another board by guessing an id. And "Duplicate board" can copy rows with only `boardId` changed, keeping element ids, so arrow bindings and `groupId`s stay valid.

---

## 6. Later additions (out of scope now)

- **`board_member` / `project_member`** (`userId`, `role`: owner / editor / viewer) for the Share button and real-time collaboration.
- **`asset`** (`key`, `boardId`, `mimeType`, `size`, `uploadedBy`) to track uploaded images and SVGs in S3, so orphaned files can be cleaned up.
- **`pending_edit`** for the "Ask Claude" queue (MCP `get_pending_edits` / `complete_edit`): `boardId`, selected ids, prompt, status, note.
- **`board_snapshot`** for version history.
