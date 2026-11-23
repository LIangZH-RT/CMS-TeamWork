-- CMS-TeamWork 表结构参考 DDL（v2，16 张表，对应 SRS v2.6）
-- !!! 这是参考脚本，不是 Flyway 迁移。各表所有者按 doc/db/schema.md §8 的版本号拆成 src/main/resources/db/migration/V<n>__*.sql 提交 !!!
-- 已在 MySQL 8.4.6 空库上按本文件顺序执行通过（2026-11-23，验证记录见 schema.md 附录 A）。时间列一律存 UTC。
-- v1（12 表）→ v2（16 表）：新增 role / permission / role_permission / sys_operation_log；
-- user.role 枚举列改为 role_id 外键并加 status、updated_at；category 加 parent_id / sort_order / status / deleted；
-- tag、article 加 deleted；media_file 加回 original_name。后端尚无代码，迁移号整体重排。

-- ==================== V1__rbac.sql ====================
-- 所有者：B。RBAC（SRS §4.7、BR-RBAC-001/002）。三张表运行时只读，种子随迁移写入，本期不提供修改角色权限的接口（D5）
CREATE TABLE role (
  id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '接口输出的角色代码',
  name       VARCHAR(20) NOT NULL COMMENT '中文名',
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_role_code (code),
  UNIQUE KEY uk_role_name (name),
  CONSTRAINT ck_role_code CHECK (code IN ('EDITOR', 'ADMIN'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色（本期内置 2 个）';

CREATE TABLE permission (
  id     SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code   VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '资源:动作，如 review:approve',
  name   VARCHAR(40) NOT NULL COMMENT '中文说明',
  module VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '分组展示',
  PRIMARY KEY (id),
  UNIQUE KEY uk_permission_code (code),
  KEY idx_permission_module (module),
  CONSTRAINT ck_permission_code CHECK (code REGEXP '^[a-z-]+(:[a-z-]+)+$')
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '权限点（SRS §4.7）';

CREATE TABLE role_permission (
  role_id       SMALLINT UNSIGNED NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permission_permission (permission_id),
  CONSTRAINT fk_role_permission_role       FOREIGN KEY (role_id)       REFERENCES role (id),
  CONSTRAINT fk_role_permission_permission FOREIGN KEY (permission_id) REFERENCES permission (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色-权限 N:M（全键表）';

INSERT INTO role (code, name, created_at) VALUES
  ('EDITOR', '内容编辑', UTC_TIMESTAMP(3)),
  ('ADMIN',  '管理员',   UTC_TIMESTAMP(3));

-- 27 个权限点（SRS §4.7 权限点清单）
INSERT INTO permission (code, name, module) VALUES
  ('article:create'     , '创建文章', 'ARTICLE'),
  ('article:update'     , '编辑文章内容与媒体引用', 'ARTICLE'),
  ('article:delete'     , '删除从未提交的草稿（含批量）', 'ARTICLE'),
  ('article:submit'     , '提交审核', 'ARTICLE'),
  ('article:withdraw'   , '撤回待发布文章', 'ARTICLE'),
  ('article:reschedule' , '改期', 'ARTICLE'),
  ('article:read'       , '读取文章详情、列表、计数', 'ARTICLE'),
  ('article:read:all'   , '可见全部文章（归属闸 ALL 作用域）', 'ARTICLE'),
  ('review:queue'       , '查看审核队列', 'REVIEW'),
  ('review:approve'     , '审核通过（含批量）', 'REVIEW'),
  ('review:reject'      , '驳回', 'REVIEW'),
  ('review:unpublish'   , '下架（含批量）', 'REVIEW'),
  ('audit:read'         , '查看文章留痕', 'AUDIT'),
  ('category:read'      , '查看分类树', 'TAX'),
  ('category:create'    , '创建分类', 'TAX'),
  ('category:update'    , '修改分类、启停、排序', 'TAX'),
  ('category:delete'    , '删除分类', 'TAX'),
  ('tag:read'           , '查看标签', 'TAX'),
  ('tag:create'         , '创建标签', 'TAX'),
  ('tag:update'         , '修改标签', 'TAX'),
  ('tag:delete'         , '删除标签', 'TAX'),
  ('media:upload'       , '上传媒体', 'MEDIA'),
  ('user:read'          , '查看用户列表', 'USER'),
  ('user:status'        , '启用 / 停用账号', 'USER'),
  ('user:assign-role'   , '分配角色', 'USER'),
  ('role:read'          , '查看角色与权限点', 'USER'),
  ('oplog:read'         , '查看系统操作日志', 'OPLOG');

-- EDITOR 14 个、ADMIN 20 个（共 34 行）；与 SRS §4.5 权限矩阵逐项对应
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p
WHERE (r.code = 'EDITOR' AND p.code IN ('article:create', 'article:update', 'article:delete', 'article:submit',
                   'article:withdraw', 'article:reschedule', 'article:read', 'audit:read',
                   'category:read', 'tag:read', 'tag:create', 'tag:update',
                   'tag:delete', 'media:upload'))
   OR (r.code = 'ADMIN'  AND p.code IN ('article:read', 'article:read:all', 'review:queue', 'review:approve',
                   'review:reject', 'review:unpublish', 'audit:read', 'category:read',
                   'category:create', 'category:update', 'category:delete', 'tag:read',
                   'tag:create', 'tag:update', 'tag:delete', 'user:read',
                   'user:status', 'user:assign-role', 'role:read', 'oplog:read'));

-- ==================== V2__user.sql ====================
-- 所有者：B（status、role_id 两列由 G 的用户管理经 B 的 UserService 写）。账号（SRS §4.1、BR-ROLE-001、BR-USER-001/002）
-- 一人一角色：role_id 单值非空外键在结构上保证（D1）；「至少一个启用管理员」由 G 的 Service 校验（BR-ROLE-004，不用函数索引）
-- 账号不删除（BR-USER-002），所以 user 没有 deleted 列，应用账号也不授 DELETE
CREATE TABLE `user` (
  id            BIGINT            NOT NULL AUTO_INCREMENT COMMENT '账号 ID',
  username      VARCHAR(32)       CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '规范化登录名：去首尾空白后转小写（api §16-#7）',
  password_hash CHAR(60)          CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'BCrypt 哈希',
  role_id       SMALLINT UNSIGNED NOT NULL COMMENT '唯一角色（BR-ROLE-001）',
  status        VARCHAR(8)        CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ENABLED' COMMENT 'ENABLED / DISABLED（BR-USER-001）',
  created_at    DATETIME(3)       NOT NULL COMMENT '注册或初始化时间（UTC），MP 自动填充',
  updated_at    DATETIME(3)       NOT NULL COMMENT '最后修改时间（UTC），MP 自动填充',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_username (username),
  KEY idx_user_role (role_id),
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES role (id),
  CONSTRAINT ck_user_username CHECK (username REGEXP '^[a-z0-9_]{3,32}$'),
  CONSTRAINT ck_user_status   CHECK (status IN ('ENABLED', 'DISABLED'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '账号';

-- 初始管理员种子（BCrypt 字面量；真实部署替换为本库自己的哈希，arch §2.5）。之后可通过角色分配增加管理员（BR-ROLE-005）
INSERT INTO `user` (username, password_hash, role_id, status, created_at, updated_at)
SELECT 'admin', '$2a$10$abcdefghijklmnopqrstuuMIOkgYxk1kZcmmuJ0u1Df0U1Ly7Xqfm', r.id, 'ENABLED', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
FROM role r WHERE r.code = 'ADMIN';

-- ==================== V3__login_throttle.sql ====================
-- 所有者：B。登录失败限制（SRS §4.1.2：同一登录名连续 5 次失败锁 15 分钟）
-- 故意不建指向 user 的外键：不存在的登录名也要计数，响应才能与真实账号一致
CREATE TABLE login_throttle (
  username             VARCHAR(32)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '规范化登录名，可以是不存在的账号',
  consecutive_failures TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当前连续失败次数；到 5 次时置锁并归零',
  locked_until         DATETIME(3)      NULL COMMENT '锁定截止（UTC）；NULL = 未锁定',
  PRIMARY KEY (username),
  CONSTRAINT ck_throttle_failures CHECK (consecutive_failures BETWEEN 0 AND 4)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '登录失败限制';

-- ==================== V4__taxonomy.sql ====================
-- 所有者：F。分类（封闭的层级集合，≤ 2 级）与标签（开放集合、扁平）
-- 名称规则（api §16-#2）：去首尾空白，1~50 字符，同类内不区分大小写唯一（排序规则 utf8mb4_0900_as_ci）
-- 逻辑删除：deleted = 0 未删除；删除时写入本行 id（@TableLogic(value = "0", delval = "id")，M0 由 B 在真库验证，见 schema.md §1）
-- 唯一键 (name, deleted) 让删除后可以重建同名（BR-DEL-007）。
-- MySQL 不允许 CHECK 引用 AUTO_INCREMENT 列，所以「deleted ∈ {0, id}」「parent_id <> id」「深度 ≤ 2」由 F 的 Service 校验
CREATE TABLE category (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  parent_id  BIGINT      NULL COMMENT '父分类；NULL = 一级分类；只能挂在一级分类下（BR-TAX-006）',
  name       VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL COMMENT '去首尾空白后 1~50 字符',
  sort_order INT         NOT NULL DEFAULT 0 COMMENT '同级升序，相同按 id（BR-TAX-007）',
  status     VARCHAR(8)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ENABLED' COMMENT 'ENABLED / DISABLED（BR-TAX-008）',
  deleted    BIGINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除标记：0 或本行 id（BR-TAX-009）',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_category_name (name, deleted),
  KEY idx_category_parent_sort (parent_id, sort_order, id),
  CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES category (id),
  CONSTRAINT ck_category_name   CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 50 AND name = TRIM(name)),
  CONSTRAINT ck_category_status CHECK (status IN ('ENABLED', 'DISABLED')),
  CONSTRAINT ck_category_deleted CHECK (deleted >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '分类（BR-TAX-003、BR-TAX-006~009）';

CREATE TABLE tag (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL COMMENT '同 category.name',
  deleted    BIGINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除标记：0 或本行 id',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tag_name (name, deleted),
  CONSTRAINT ck_tag_name    CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 50 AND name = TRIM(name)),
  CONSTRAINT ck_tag_deleted CHECK (deleted >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '标签（BR-TAX-003、BR-SEARCH-006）';

-- ==================== V5__article.sql ====================
-- 所有者：C。status / scheduled_publish_time / published_at 只经 G 的状态机写（INV-01）
-- cover_media_id / audio_media_id 的外键在 V11 补（与 media_file 互相引用）
-- 逻辑删除（BR-DEL-002）：只有从未提交的草稿能删，所以删除标记必然落在 DRAFT 行上（ck_article_deleted）
CREATE TABLE article (
  id                     BIGINT       NOT NULL AUTO_INCREMENT,
  author_id              BIGINT       NOT NULL COMMENT '归属编辑，创建后不可改（INV-08）',
  category_id            BIGINT       NOT NULL COMMENT '单选必填（BR-TAX-001）',
  title                  VARCHAR(200) NOT NULL COMMENT '不允许全空白，≤ 200（api §16-#3）',
  excerpt                VARCHAR(500) NOT NULL DEFAULT '' COMMENT '未填为空串，不自动截取，≤ 500',
  content                MEDIUMTEXT   NOT NULL COMMENT 'Markdown 原文（INV-06），≤ 1 MiB',
  cover_media_id         BIGINT       NULL COMMENT '当前封面；FK 见 V11；同文章、用途 COVER 由 Service 校验',
  audio_media_id         BIGINT       NULL COMMENT '当前音频；FK 见 V11；同文章、用途 AUDIO 由 Service 校验',
  scheduled_publish_time DATETIME(3)  NULL COMMENT '预定发布时间（UTC），撤回时清空（BR-PUB-009）',
  status                 VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'DRAFT' COMMENT '6 个英文代码，与 api §4.1 一致',
  published_at           DATETIME(3)  NULL COMMENT '本次实际发布时间，下架保留（SRS §5.5、INV-07）；受控冗余',
  deleted                BIGINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除标记：0 或本行 id（BR-DEL-002）',
  created_at             DATETIME(3)  NOT NULL,
  updated_at             DATETIME(3)  NOT NULL COMMENT '内容最后修改时间；状态迁移不改它',
  version                INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁（MyBatis-Plus @Version，api §16-#11）',
  PRIMARY KEY (id),
  KEY idx_article_author_status (author_id, deleted, status, updated_at),
  KEY idx_article_status_published (status, published_at),
  KEY idx_article_status_schedule (status, scheduled_publish_time),
  KEY idx_article_category (category_id),
  KEY idx_article_cover (cover_media_id),
  KEY idx_article_audio (audio_media_id),
  CONSTRAINT fk_article_author   FOREIGN KEY (author_id)   REFERENCES `user` (id),
  CONSTRAINT fk_article_category FOREIGN KEY (category_id) REFERENCES category (id),
  CONSTRAINT ck_article_status CHECK (status IN ('DRAFT','PENDING_REVIEW','REJECTED','SCHEDULED','PUBLISHED','UNPUBLISHED')),
  CONSTRAINT ck_article_title  CHECK (CHAR_LENGTH(TRIM(title)) > 0),
  CONSTRAINT ck_article_content_size CHECK (OCTET_LENGTH(content) <= 1048576),
  CONSTRAINT ck_article_published CHECK (status NOT IN ('PUBLISHED','UNPUBLISHED') OR published_at IS NOT NULL),
  CONSTRAINT ck_article_scheduled CHECK (status <> 'SCHEDULED' OR scheduled_publish_time IS NOT NULL),
  CONSTRAINT ck_article_deleted   CHECK (deleted = 0 OR (deleted > 0 AND status = 'DRAFT'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '文章';

-- ==================== V6__article_tag.sql ====================
-- 所有者：F。文章-标签 N:M（BR-TAX-002）；交集筛选用 (tag_id, article_id)（BR-SEARCH-005）
-- 文章逻辑删除时同一事务物理删除其关联行（BR-DEL-004）
CREATE TABLE article_tag (
  article_id BIGINT NOT NULL,
  tag_id     BIGINT NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  KEY idx_article_tag_tag (tag_id, article_id),
  CONSTRAINT fk_article_tag_article FOREIGN KEY (article_id) REFERENCES article (id),
  CONSTRAINT fk_article_tag_tag     FOREIGN KEY (tag_id)     REFERENCES tag (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '文章-标签关联';

-- ==================== V7__media.sql ====================
-- 所有者：E。媒体格式字典 + 媒体文件索引 + 文件删除失败重试表（实验二上传下载的延续，SRS FR-MEDIA-001/005）
CREATE TABLE media_format (
  code       VARCHAR(8)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '服务端按魔数判定的真实格式',
  media_kind VARCHAR(5)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'IMAGE / AUDIO',
  mime_type  VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '响应 Content-Type',
  extension  VARCHAR(8)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '存储文件扩展名（规范形式）',
  PRIMARY KEY (code),
  UNIQUE KEY uk_media_format_mime (mime_type),
  UNIQUE KEY uk_media_format_ext (extension),
  CONSTRAINT ck_media_format_kind CHECK (media_kind IN ('IMAGE', 'AUDIO'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '媒体格式白名单（BR-MEDIA-002/005）';

INSERT INTO media_format (code, media_kind, mime_type, extension) VALUES
  ('JPEG', 'IMAGE', 'image/jpeg', 'jpg'),
  ('PNG',  'IMAGE', 'image/png',  'png'),
  ('GIF',  'IMAGE', 'image/gif',  'gif'),
  ('WEBP', 'IMAGE', 'image/webp', 'webp'),
  ('MP3',  'AUDIO', 'audio/mpeg', 'mp3'),
  ('M4A',  'AUDIO', 'audio/mp4',  'm4a'),
  ('WAV',  'AUDIO', 'audio/wav',  'wav'),
  ('OGG',  'AUDIO', 'audio/ogg',  'ogg');

-- 用途与格式大类是否匹配（封面不能是 MP3）由 E 的上传 Service 校验，库里不做复合外键
-- original_name：上传时的原始文件名，仅用于下载的 Content-Disposition（FR-MEDIA-005），不参与存储路径
CREATE TABLE media_file (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  article_id    BIGINT       NOT NULL COMMENT '唯一归属文章，上传时确定、不可改派（BR-MEDIA-008）',
  media_usage   VARCHAR(12)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'COVER / INLINE_IMAGE / AUDIO；接口字段名 usage',
  format_code   VARCHAR(8)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '真实格式 → mime、扩展名',
  storage_key   CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '系统生成的 UUID；路径 = {cover|inline|audio}/{key}.{ext}，不存',
  original_name VARCHAR(255) NOT NULL COMMENT '上传时的原始文件名（去路径），下载文件名用（FR-MEDIA-005）',
  size_bytes    INT UNSIGNED NOT NULL,
  linked_at     DATETIME(3)  NULL COMMENT '首次保存进文章引用的时间；NULL = 未关联上传；解除引用即删行',
  created_at    DATETIME(3)  NOT NULL COMMENT '上传时间（24 小时清理起点）',
  PRIMARY KEY (id),
  UNIQUE KEY uk_media_storage_key (storage_key),
  KEY idx_media_article_usage (article_id, media_usage),
  KEY idx_media_unlinked (linked_at, created_at),
  CONSTRAINT fk_media_article FOREIGN KEY (article_id)  REFERENCES article (id),
  CONSTRAINT fk_media_format  FOREIGN KEY (format_code) REFERENCES media_format (code),
  CONSTRAINT ck_media_usage CHECK (media_usage IN ('COVER', 'INLINE_IMAGE', 'AUDIO')),
  CONSTRAINT ck_media_original_name CHECK (CHAR_LENGTH(TRIM(original_name)) > 0),
  CONSTRAINT ck_media_size  CHECK (size_bytes > 0 AND size_bytes <= (CASE media_usage WHEN 'AUDIO' THEN 20971520 ELSE 5242880 END))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '媒体文件索引（不存字节）';

-- 只记「删文件失败」的文件，由 @Scheduled 任务重试；成功即删行。不做状态机
CREATE TABLE media_purge_job (
  id              BIGINT            NOT NULL AUTO_INCREMENT,
  storage_path    VARCHAR(64)       CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '待删文件相对路径（源 media_file 行已删除）',
  attempts        SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '已失败次数',
  last_error      VARCHAR(500)      NULL COMMENT '最近一次失败原因（BR-MEDIA-004「记录」）',
  first_failed_at DATETIME(3)       NOT NULL,
  next_attempt_at DATETIME(3)       NOT NULL COMMENT '下次重试时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_purge_path (storage_path),
  KEY idx_purge_due (next_attempt_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '文件删除失败重试（BR-MEDIA-004、BR-DEL-004）';

-- ==================== V8__review_lookup.sql ====================
-- 所有者：D。驳回类别字典 + 审核标准版本登记（两张都运行时只读，改动只走迁移）
CREATE TABLE reject_category (
  code           VARCHAR(32)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'api §4.1 的英文值',
  label          VARCHAR(20)      NOT NULL COMMENT '中文名',
  category_group VARCHAR(10)      CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'COMPLIANCE / QUALITY / OTHER；分组为【建议】，SRS 未规定',
  sort_order     TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (code),
  UNIQUE KEY uk_reject_category_label (label),
  UNIQUE KEY uk_reject_category_sort (sort_order),
  CONSTRAINT ck_reject_category_group CHECK (category_group IN ('COMPLIANCE', 'QUALITY', 'OTHER'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '驳回类别（固定 8 类，BR-CONTENT-005）';

INSERT INTO reject_category (code, label, category_group, sort_order) VALUES
  ('ILLEGAL',                   '违法违规',             'COMPLIANCE', 1),
  ('AUTHENTICITY_SOURCE',       '真实性／来源',         'COMPLIANCE', 2),
  ('COPYRIGHT_PRIVACY',         '版权／隐私',           'COMPLIANCE', 3),
  ('MINOR_VULGAR_VIOLENCE',     '未成年人／低俗／暴力', 'COMPLIANCE', 4),
  ('DISCRIMINATION_HARASSMENT', '歧视／骚扰／引战',     'COMPLIANCE', 5),
  ('SPAM_MARKETING',            '垃圾／营销',           'QUALITY',    6),
  ('QUALITY_POSITIONING',       '内容质量／博客定位',   'QUALITY',    7),
  ('OTHER',                     '其他',                 'OTHER',      8);

-- 当前版本 = effective_from <= now 的最新一行；升级 = 新增一个只含 INSERT 的迁移（SRS §6.1.1）
CREATE TABLE review_standard (
  id             SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  version_code   VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '如 CMS-CONTENT-REVIEW-1.0',
  effective_from DATETIME(3) NOT NULL COMMENT '生效时间（UTC）',
  PRIMARY KEY (id),
  UNIQUE KEY uk_review_standard_version (version_code),
  UNIQUE KEY uk_review_standard_effective (effective_from)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '审核标准版本登记（SRS §6.1.1）';

INSERT INTO review_standard (version_code, effective_from) VALUES ('CMS-CONTENT-REVIEW-1.0', '2026-01-01 00:00:00.000');

-- ==================== V9__audit_log.sql ====================
-- 所有者：H。流程留痕，只增不改不删（BR-AUDIT-001，应用账号仅 SELECT/INSERT）
-- 库里只放 3 条关键条件 CHECK（操作人、驳回、下架）；SRS §6.6 其余条件字段规则由 AuditWriter 校验
-- 与 sys_operation_log 分工（D8）：本表是文章流程的业务事实，与业务同事务；后者是运维审计，独立事务
CREATE TABLE audit_log (
  id                    BIGINT       NOT NULL AUTO_INCREMENT,
  article_id            BIGINT       NOT NULL,
  action                VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '7 类（SRS §6.6）',
  actor_type            VARCHAR(6)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'USER / SYSTEM；受控冗余（BR-AUDIT-004）',
  actor_id              BIGINT       NULL COMMENT 'USER 时为账号 ID；SYSTEM 时为 NULL',
  created_at            DATETIME(3)  NOT NULL COMMENT '服务端操作时间（UTC）',
  reason                VARCHAR(500) NULL COMMENT '驳回意见 / 下架原因；其余 NULL',
  reject_category_code  VARCHAR(32)  CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '仅驳回',
  review_standard_id    SMALLINT UNSIGNED NULL COMMENT '仅审核通过 / 驳回 / 下架',
  published_at          DATETIME(3)  NULL COMMENT '审核通过且立即发布、到期自动发布',
  schedule_from         DATETIME(3)  NULL COMMENT '仅改期：原时间',
  schedule_to           DATETIME(3)  NULL COMMENT '仅改期：新时间',
  related_approval_id   BIGINT       NULL COMMENT '仅到期自动发布：所依据的审核通过留痕',
  related_submission_id BIGINT       NULL COMMENT '仅审核通过 / 驳回：本轮提交审核留痕（= 提交轮次）',
  PRIMARY KEY (id),
  KEY idx_audit_article_action_time (article_id, action, created_at, id),
  KEY idx_audit_article_time (article_id, created_at, id),
  KEY idx_audit_actor (actor_id),
  UNIQUE KEY uk_audit_approval_once (related_approval_id) COMMENT '一次审核通过最多被到期发布一次（INV-07）',
  UNIQUE KEY uk_audit_submission_once (related_submission_id) COMMENT '一轮提交最多一个审核结论（SRS §5.6）',
  CONSTRAINT fk_audit_article         FOREIGN KEY (article_id)            REFERENCES article (id),
  CONSTRAINT fk_audit_actor           FOREIGN KEY (actor_id)              REFERENCES `user` (id),
  CONSTRAINT fk_audit_reject_category FOREIGN KEY (reject_category_code)  REFERENCES reject_category (code),
  CONSTRAINT fk_audit_standard        FOREIGN KEY (review_standard_id)    REFERENCES review_standard (id),
  CONSTRAINT fk_audit_approval        FOREIGN KEY (related_approval_id)   REFERENCES audit_log (id),
  CONSTRAINT fk_audit_submission      FOREIGN KEY (related_submission_id) REFERENCES audit_log (id),
  -- 取值域
  CONSTRAINT ck_audit_action     CHECK (action IN ('SUBMIT','APPROVE','REJECT','UNPUBLISH','WITHDRAW','RESCHEDULE','AUTO_PUBLISH')),
  CONSTRAINT ck_audit_actor_type CHECK (actor_type IN ('USER', 'SYSTEM')),
  -- 关键条件 1：操作人类型与账号咬合，且只有到期自动发布是系统（BR-AUDIT-004）
  CONSTRAINT ck_audit_actor CHECK ((actor_type = 'USER') = (actor_id IS NOT NULL)
                               AND (actor_type = 'SYSTEM') = (action = 'AUTO_PUBLISH')),
  -- 关键条件 2：驳回必须有类别和非空意见（BR-004、BR-CONTENT-005、BR-AUDIT-003）
  CONSTRAINT ck_audit_reject CHECK (action <> 'REJECT'
                                 OR (reject_category_code IS NOT NULL AND reason IS NOT NULL AND TRIM(reason) <> '')),
  -- 关键条件 3：下架必须有非空原因（BR-008、BR-AUDIT-003）
  CONSTRAINT ck_audit_unpublish CHECK (action <> 'UNPUBLISH' OR (reason IS NOT NULL AND TRIM(reason) <> ''))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '流程留痕';

-- ==================== V10__sys_operation_log.sql ====================
-- 所有者：H。系统操作日志（SRS §6.7、BR-OPLOG-001~005），由 @OperationLog 切面写入，独立事务、尽力写入
-- 只增不改不删（应用账号仅 SELECT/INSERT）；不存请求体、密码、登录失败时尝试的登录名（BR-OPLOG-003）
-- 不存操作人登录名：它由 operator_id 决定，存了就是传递依赖
CREATE TABLE sys_operation_log (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  operator_id  BIGINT       NULL COMMENT '操作人；匿名（登录失败、注册）为 NULL',
  module       VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'AUTH / ARTICLE / REVIEW / TAX / MEDIA / USER',
  operation    VARCHAR(24)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '如 ARTICLE_DELETE、LOGIN_FAILED',
  target_type  VARCHAR(16)  CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '如 ARTICLE、CATEGORY、USER；由注解 SpEL 取值',
  target_id    BIGINT       NULL COMMENT '目标 ID；批量操作为 NULL',
  http_method  VARCHAR(6)   CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_uri  VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '不含查询串',
  client_ip    VARCHAR(45)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'IPv6 最长 45',
  success      BOOLEAN      NOT NULL,
  error_code   INT          NULL COMMENT '失败时的业务错误码（api §3.3）；成功为 NULL',
  duration_ms  INT UNSIGNED NOT NULL,
  created_at   DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_oplog_time (created_at, id),
  KEY idx_oplog_operator_time (operator_id, created_at),
  KEY idx_oplog_module_time (module, created_at),
  CONSTRAINT fk_oplog_operator FOREIGN KEY (operator_id) REFERENCES `user` (id),
  CONSTRAINT ck_oplog_module    CHECK (module IN ('AUTH', 'ARTICLE', 'REVIEW', 'TAX', 'MEDIA', 'USER')),
  CONSTRAINT ck_oplog_operation CHECK (operation REGEXP '^[A-Z][A-Z_]*$'),
  CONSTRAINT ck_oplog_method    CHECK (http_method IN ('POST', 'PUT', 'PATCH', 'DELETE')),
  CONSTRAINT ck_oplog_target    CHECK (target_id IS NULL OR target_type IS NOT NULL),
  CONSTRAINT ck_oplog_error     CHECK ((success AND error_code IS NULL) OR (NOT success AND error_code IS NOT NULL))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统操作日志（运维审计）';

-- ==================== V11__article_media_fk.sql ====================
-- 所有者：C。article 与 media_file 互相引用，外键只能在两张表都存在后补上
-- 外键只保证「指向存在的媒体」；同文章、用途匹配由 C/E 的 Service 在同一事务内校验
ALTER TABLE article
  ADD CONSTRAINT fk_article_cover FOREIGN KEY (cover_media_id) REFERENCES media_file (id),
  ADD CONSTRAINT fk_article_audio FOREIGN KEY (audio_media_id) REFERENCES media_file (id);

-- ==================== R__app_grants.sql ====================
-- 所有者：B。cms_app 为应用运行时账号（INV-04）；库名按环境替换
-- 逻辑删除的表（category、tag、article）和不可删除的 user 不授 DELETE：误写成物理删除会直接被权限拒绝
-- GRANT 只增不减：从 v1 库升级或以后收紧权限时，要先对相应表 REVOKE 再重新授予
GRANT SELECT, INSERT, UPDATE         ON cms.`user`          TO 'cms_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON cms.login_throttle  TO 'cms_app'@'%';
GRANT SELECT, INSERT, UPDATE         ON cms.category        TO 'cms_app'@'%';
GRANT SELECT, INSERT, UPDATE         ON cms.tag             TO 'cms_app'@'%';
GRANT SELECT, INSERT, UPDATE         ON cms.article         TO 'cms_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON cms.article_tag     TO 'cms_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON cms.media_file      TO 'cms_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON cms.media_purge_job TO 'cms_app'@'%';
-- RBAC 与字典表：运行时只读（BR-RBAC-002、D5）
GRANT SELECT ON cms.role            TO 'cms_app'@'%';
GRANT SELECT ON cms.permission      TO 'cms_app'@'%';
GRANT SELECT ON cms.role_permission TO 'cms_app'@'%';
GRANT SELECT ON cms.media_format    TO 'cms_app'@'%';
GRANT SELECT ON cms.reject_category TO 'cms_app'@'%';
GRANT SELECT ON cms.review_standard TO 'cms_app'@'%';
-- 留痕、操作日志：只增不改不删
GRANT SELECT, INSERT ON cms.audit_log         TO 'cms_app'@'%';
GRANT SELECT, INSERT ON cms.sys_operation_log TO 'cms_app'@'%';
