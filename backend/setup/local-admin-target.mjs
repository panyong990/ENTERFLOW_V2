import { SetupError } from './local-admin-core.mjs';

export function verifyRuntimeTarget(runtime, env) {
  if (runtime.production || env.BROWSER_TEST_RUNTIME || runtime.database.host !== '127.0.0.1' ||
      runtime.database.port !== 3308 || runtime.database.name !== 'enterflow_db') throw new SetupError('LOCAL_DEVELOPMENT_TARGET_REQUIRED');
}

export function verifyContainerTarget(record, context, info) {
  if (context?.Endpoints?.docker?.Host !== 'npipe:////./pipe/dockerDesktopLinuxEngine') throw new SetupError('NONLOCAL_DOCKER_CONTEXT');
  const digest = 'sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902';
  if (!/^[a-f0-9]{64}$/.test(record.container_id ?? '') || !/^[a-f0-9-]{36}$/i.test(record.server_uuid ?? '') || record.image_id !== digest ||
      info?.Id !== record.container_id || info.Image !== record.image_id || !info.State.Running ||
      info.State.Health?.Status !== 'healthy' || info.Config.Labels?.['enterflow.role'] !== 'development' ||
      JSON.stringify(info.HostConfig.PortBindings) !== JSON.stringify({ '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: '3308' }] }) ||
      info.Mounts.length !== 1 || info.Mounts[0].Type !== 'volume' || info.Mounts[0].Name !== 'enterflow-mysql-dev-data' || info.Mounts[0].Destination !== '/var/lib/mysql') {
    throw new SetupError('CONTAINER_IDENTITY_REJECTED');
  }
}
