#!/usr/bin/env bash
# 批量部署云函数到指定云环境（wxcloud CLI，创建+部署，云端装依赖）。
# 默认 dev（原环境），--prod 部署到正式环境。会先据目标环境的 .env / .env.prod
# 重新生成各函数 db.js/secret.js，再逐个上传，保证连对数据库。
#
# 前置：① 已 `npx wxcloud login` 授权到小程序账号；② cpolar 隧道在跑；
#       ③ 生产部署前已准备好根目录 .env.prod（连 xingshu_prod）。
# 用法：bash scripts/deploy-functions.sh                部署全部到 dev
#       bash scripts/deploy-functions.sh --prod         部署全部到 prod
#       bash scripts/deploy-functions.sh --prod admin getDiaryList   仅部分函数到 prod
#
# 注意：generateMiniCode 依赖 openapi 权限（wxacode.getUnlimited），CLI 不一定应用其
#       config.json 的权限——若扫码报 -604101，请改用微信开发者工具对该函数「上传并部署」。
set -u
DEV_ENV="cloud1-d9gbozhfp4a6c50c0"
PROD_ENV="cloud1-xingshu-prd-d1cev0fcca864"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/miniprogram/cloudfunctions"

TARGET="dev"; ENVID="$DEV_ENV"; ENVFILE=".env"
FNS=""
for a in "$@"; do
  case "$a" in
    --prod) TARGET="prod"; ENVID="$PROD_ENV"; ENVFILE=".env.prod" ;;
    --dev)  TARGET="dev";  ENVID="$DEV_ENV";  ENVFILE=".env" ;;
    *) FNS="$FNS $a" ;;
  esac
done

echo ">>> 目标环境：$TARGET（$ENVID）；数据库配置来源：$ENVFILE"
echo ">>> 生成各函数 db.js / secret.js ..."
node "$ROOT/scripts/sync-db-config.js" "$ENVFILE" || { echo "!!! sync-db 失败（检查根目录是否存在 $ENVFILE）"; exit 1; }

# 参数指定则只部署这些，否则全部
[ -n "${FNS// /}" ] || FNS="$(ls "$DIR")"

fail=0
for fn in $FNS; do
  [ -d "$DIR/$fn" ] || { echo "跳过（非目录）：$fn"; continue; }
  echo "========== 部署 $fn → $TARGET =========="
  npx --no-install wxcloud function:upload "$DIR/$fn" -e "$ENVID" -n "$fn" --remoteNpmInstall \
    || { echo "!!! $fn 部署失败"; fail=1; }
done

echo ""
[ "$fail" -eq 0 ] && echo "全部完成（部署到 $TARGET）。" || echo "有函数部署失败，见上方 !!! 标记。"
exit $fail
