/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, Output, EventEmitter } from '@angular/core';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { nb } from 'sqlops';
import { INotebookService } from 'sql/services/notebook/notebookService';
import { MimeModel } from 'sql/parts/notebook/outputs/common/mimemodel';
import * as outputProcessor from '../outputs/common/outputProcessor';
import { RenderMimeRegistry } from 'sql/parts/notebook/outputs/registry';
import 'vs/css!sql/parts/notebook/outputs/style/index';

export const OUTPUT_SELECTOR: string = 'output-component';

@Component({
	selector: OUTPUT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./output.component.html'))
})
export class OutputComponent extends AngularDisposable implements OnInit {
	@ViewChild('output', { read: ElementRef }) private outputElement: ElementRef;
	@Input() cellOutput: nb.ICellOutput;
	@Input() trustedMode: boolean;
	private readonly _minimumHeight = 30;
	registry: RenderMimeRegistry;


	constructor(
		@Inject(INotebookService) private _notebookService: INotebookService
	) {
		super();
		this.registry = _notebookService.getMimeRegistry();
	}

	ngOnInit() {
		let node = this.outputElement.nativeElement;
		let output = this.cellOutput;
		let options = outputProcessor.getBundleOptions({ value: output, trusted: this.trustedMode });
		// TODO handle safe/unsafe mapping
		this.createRenderedMimetype(options, node);
	}

	public layout(): void {
	}

	protected createRenderedMimetype(options: MimeModel.IOptions, node: HTMLElement): void {
		let mimeType = this.registry.preferredMimeType(
			options.data,
			options.trusted ? 'any' : 'ensure'
		);
		if (mimeType) {
			let output = this.registry.createRenderer(mimeType);
			output.node = node;
			let model = new MimeModel(options);
			output.renderModel(model).catch(error => {
				// Manually append error message to output
				output.node.innerHTML = `<pre>Javascript Error: ${error.message}</pre>`;
				// Remove mime-type-specific CSS classes
				output.node.className = 'p-Widget jp-RenderedText';
				output.node.setAttribute(
					'data-mime-type',
					'application/vnd.jupyter.stderr'
				);
			});
			//this.setState({ node: node });
		} else {
			// TODO Localize
			node.innerHTML =
				`No ${options.trusted ? '' : '(safe) '}renderer could be ` +
				'found for output. It has the following MIME types: ' +
				Object.keys(options.data).join(', ');
			//this.setState({ node: node });
		}
	}
}