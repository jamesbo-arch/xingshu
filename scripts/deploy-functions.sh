#!/usr/bin/env bash
# 批量部署所有云函数到指定环境（wxcloud CLI，创建+部署，云端装依赖）。
# 前置：① 已 `npx wxcloud login` 授权到小程序对应账号；② 根目录已 `npm run sync-db`
#       生成各函数 db.js / admin 的 secret.js；③ cpolar 隧道在跑（连库函数需要）。
# 用法：bash scripts/deploy-functions.sh            部署全部
#       bash scripts/deploy-functions.sh admin getDiaryList   仅部署指定函数
#
# 注意：generateMiniCode 依赖 openapi 权限（wxacode.getUnlimited），CLI 不一定会
#       应用其 config.json 的权限——若扫码生成报 -604101，请改用微信开发者工具
#       对 generateMiniCode 单独「上传并部署」，或在云开发控制台手动加该权限。
set -u
ENV="cloud1-d9gbozhfp4a6c50c0"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/miniprogram/cloudfunctions"

# 参数指定则只部署这些，否则全部
if [ "$#" -gt 0 ]; then FNS="$*"; else FNS="$(ls "$DIR")"; fi

fail=0
for fn in $FNS; do
  [ -d "$DIR/$fn" ] || { echo "跳过（非目录）：$fn"; continue; }
  echo "========== 部署 $fn =========="
  npx --no-install wxcloud function:upload "$DIR/$fn" -e "$ENV" -n "$fn" --remoteNpmInstall \
    || { echo "!!! $fn 部署失败"; fail=1; }
done

echo ""
[ "$fail" -eq 0 ] && echo "全部完成。" || echo "有函数部署失败，见上方 !!! 标记。"
exit $fail
