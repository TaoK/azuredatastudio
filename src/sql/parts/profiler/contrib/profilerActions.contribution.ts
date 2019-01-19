/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService, IConnectionDialogService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from '../../objectExplorer/common/objectExplorerService';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { TPromise } from 'vs/base/common/winjs.base';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IProfilerService } from 'sql/workbench/services/profiler/common/interfaces';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'vs/editor/editor.api';
import { ProfilerEditor } from '../editor/profilerEditor';
import { ObjectExplorerActionsContext } from 'sql/parts/objectExplorer/viewlet/objectExplorerActions';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

CommandsRegistry.registerCommand({
	id: 'profiler.newProfiler',
	handler: (accessor: ServicesAccessor, ...args: any[]) => {
		let connectionProfile: ConnectionProfile = undefined;
		let instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		let editorService: IEditorService = accessor.get(IEditorService);
		let connectionService: IConnectionManagementService = accessor.get(IConnectionManagementService);
		let objectExplorerService: IObjectExplorerService = accessor.get(IObjectExplorerService);
		let connectionDialogService: IConnectionDialogService = accessor.get(IConnectionDialogService);
		let capabilitiesService: ICapabilitiesService = accessor.get(ICapabilitiesService);

		// If a context is available if invoked from the context menu, we will use the connection profiler of the server node
		if (args && args.length === 1 && args[0] && args[0] instanceof ObjectExplorerActionsContext) {
			let context = args[0] as ObjectExplorerActionsContext;
			connectionProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, context.connectionProfile);
		}
		else {
			// No context available, we will try to get the current global active connection
			connectionProfile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionService, editorService) as ConnectionProfile;
		}

		let promise;
		if (connectionProfile) {
			promise = connectionService.connectIfNotConnected(connectionProfile, 'connection', true);
		} else {
			// if still no luck, we will open the Connection dialog and let user connect to a server
			promise = connectionDialogService.openDialogAndWait(connectionService, { connectionType: 0, showDashboard: false, providers: [mssqlProviderName] }).then((profile) => {
				connectionProfile = profile as ConnectionProfile;
			});
		}

		return promise.then(() => {
			if (!connectionProfile) {
				connectionProfile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionService, editorService) as ConnectionProfile;
			}

			if (connectionProfile && connectionProfile.providerName === mssqlProviderName) {
				let profilerInput = instantiationService.createInstance(ProfilerInput, connectionProfile);
				editorService.openEditor(profilerInput, { pinned: true }, ACTIVE_GROUP).then(() => TPromise.as(true));
			}
		});
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'profiler.newProfiler',
	weight: KeybindingWeight.BuiltinExtension,
	when: undefined,
	primary: KeyMod.Alt | KeyCode.KEY_P,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KEY_P },
	handler: CommandsRegistry.getCommand('profiler.newProfiler').handler
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'profiler.toggleStartStop',
	weight: KeybindingWeight.EditorContrib,
	when: undefined,
	primary: KeyMod.Alt | KeyCode.KEY_S,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KEY_S },
	handler: (accessor: ServicesAccessor) => {
		let profilerService: IProfilerService = accessor.get(IProfilerService);
		let editorService: IEditorService = accessor.get(IEditorService);

		let activeEditor = editorService.activeControl;
		if (activeEditor instanceof ProfilerEditor) {
			let profilerInput = activeEditor.input;
			if (profilerInput.state.isRunning) {
				return profilerService.stopSession(profilerInput.id);
			} else {
				// clear data when profiler is started
				profilerInput.data.clear();
				return profilerService.startSession(profilerInput.id, profilerInput.sessionName);
			}
		}
		return TPromise.as(false);
	}
});
