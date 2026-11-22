-- OWNER SQL Editor ONLY. READ ONLY; do not delete any object automatically.
-- Requires C06 schema and privileged SQL editor, never a web/RPC route.
select count(*) as storage_objects_without_cms_record
from storage.objects o left join private.cms_media_assets a on a.object_key=o.name
where o.bucket_id='iojh-cms-media' and a.id is null;
select count(*) as retired_versions_still_in_storage
from private.cms_media_assets a join storage.objects o on o.bucket_id='iojh-cms-media' and o.name=a.object_key
where a.status='retired';
select count(*) as referenced_object_versions
from private.cms_revision_media;
