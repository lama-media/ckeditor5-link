/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module link/linkediting
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import LinkCommand from './linkcommand';
import UnlinkCommand from './unlinkcommand';
import { createLinkElement, ensureSafeUrl, getLocalizedDecorators, normalizeDecorators } from './utils';
import AutomaticDecorators from './utils/automaticdecorators';
import ManualDecorator from './utils/manualdecorator';
import bindTwoStepCaretToAttribute from '@ckeditor/ckeditor5-engine/src/utils/bindtwostepcarettoattribute';
import findLinkRange from './findlinkrange';
import '../theme/link.css';

const HIGHLIGHT_CLASS = 'ck-link_selected';
const DECORATOR_AUTOMATIC = 'automatic';
const DECORATOR_MANUAL = 'manual';
const EXTERNAL_LINKS_REGEXP = /^(https?:)?\/\//;

/**
 * The link engine feature.
 *
 * It introduces the `linkHref="url"` attribute in the model which renders to the view as a `<a href="url">` element
 * as well as `'link'` and `'unlink'` commands.
 *
 * @extends module:core/plugin~Plugin
 */
export default class LinkEditing extends Plugin {
	/**
	 * @inheritDoc
	 */
	constructor( editor ) {
		super( editor );

		editor.config.define( 'link', {
			addTargetToExternalLinks: false
		} );
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;

		// Allow link attribute on all inline nodes.
		editor.model.schema.extend( '$text', { allowAttributes: 'linkHref' } );
    editor.model.schema.extend( '$text', { allowAttributes: 'class' } );
    editor.model.schema.extend( '$text', { allowAttributes: 'id' } );

		editor.conversion.for( 'dataDowncast' )
			.attributeToElement( { model: 'linkHref', view: createLinkElement } );

    editor.conversion.for( 'editingDowncast' )
			.attributeToElement( { model: 'linkHref', view: ( href, writer ) => {
				return createLinkElement( ensureSafeUrl( href ), writer );
			} } );

		editor.conversion.for( 'upcast' )
			.elementToAttribute( {
				view: {
					name: 'a',
					attributes: {
						href: true
					}
				},
				model: {
					key: 'linkHref',
					value: viewElement => viewElement.getAttribute( 'href' )
				}
			} );

    editor.conversion.for( 'upcast' )
      .elementToAttribute( {
        view: {
          name: 'a',
          attributes: {
            id: true
          }
        },
        model: {
          key: 'id'
				}
		} );

    editor.conversion.for( 'downcast' ).attributeToElement( {
      model: 'id',
      view: ( value, writer ) => {
      	console.log('downcast for id', value, writer)
				if ( value ) {
          const attributes = { 'id': value };
					const element = writer.createAttributeElement( 'a', attributes, { priority: 5 } );
					writer.setCustomProperty( 'link', true, element );
					return element;
				}
			} } );

    editor.conversion.for( 'upcast' )
      .elementToAttribute( {
        view: {
          name: 'a',
          attributes: {
            class: true
          }
        },
        model: {
          key: 'class',
          value: viewElement => viewElement.getAttribute( 'class' )
      }
  	} );

    editor.conversion.for( 'downcast' ).attributeToElement( {
      model: 'class',
      view: ( value, writer ) => {
				console.log('downcast for class', value, writer)
				if ( value ) {
					const attributes = { 'class': value };
					const element = writer.createAttributeElement( 'a', attributes, { priority: 5 } );
					writer.setCustomProperty( 'link', true, element );
					return element;
				}
			} } );

		// Create linking commands.
		editor.commands.add( 'link', new LinkCommand( editor ) );
		editor.commands.add( 'unlink', new UnlinkCommand( editor ) );

		const linkDecorators = getLocalizedDecorators( editor.t, normalizeDecorators( editor.config.get( 'link.decorators' ) ) );

		this._enableAutomaticDecorators( linkDecorators.filter( item => item.mode === DECORATOR_AUTOMATIC ) );
		this._enableManualDecorators( linkDecorators.filter( item => item.mode === DECORATOR_MANUAL ) );

		// Enable two-step caret movement for `linkHref` attribute.
		bindTwoStepCaretToAttribute( editor.editing.view, editor.model, this, 'linkHref' );

		// Setup highlight over selected link.
		this._setupLinkHighlight();
	}

	/**
	 * Processes an array of configured {@link module:link/link~LinkDecoratorAutomaticDefinition automatic decorators}
	 * and registers a {@link module:engine/conversion/downcastdispatcher~DowncastDispatcher downcast dispatcher}
	 * for each one of them. Downcast dispatchers are obtained using the
	 * {@link module:link/utils~AutomaticDecorators#getDispatcher} method.
	 *
	 * **Note**: This method also activates the automatic external link decorator if enabled via
	 * {@link module:link/link~LinkConfig#addTargetToExternalLinks `config.link.addTargetToExternalLinks`}.
	 *
	 * @private
	 * @param {Array.<module:link/link~LinkDecoratorAutomaticDefinition>} automaticDecoratorDefinitions
	 */
	_enableAutomaticDecorators( automaticDecoratorDefinitions ) {
		const editor = this.editor;
		const automaticDecorators = new AutomaticDecorators();

		// Adds default decorator for external links.
		if ( editor.config.get( 'link.addTargetToExternalLinks' ) ) {
			automaticDecorators.add( {
				id: 'linkIsExternal',
				mode: DECORATOR_AUTOMATIC,
				callback: url => EXTERNAL_LINKS_REGEXP.test( url ),
				attributes: {
					target: '_blank',
					rel: 'noopener noreferrer'
				}
			} );
		}

		automaticDecorators.add( automaticDecoratorDefinitions );

		if ( automaticDecorators.length ) {
			editor.conversion.for( 'downcast' ).add( automaticDecorators.getDispatcher() );
		}
	}

	/**
	 * Processes an array of configured {@link module:link/link~LinkDecoratorManualDefinition manual decorators}
	 * and transforms them into {@link module:link/utils~ManualDecorator} instances and stores them in the
	 * {@link module:link/linkcommand~LinkCommand#manualDecorators} collection (a model for manual decorators state).
	 *
	 * Also registers an {@link module:engine/conversion/downcasthelpers~DowncastHelpers#attributeToElement attributeToElement}
	 * converter for each manual decorator and extends the {@link module:engine/model/schema~Schema model's schema}
	 * with adequate model attributes.
	 *
	 * @private
	 * @param {Array.<module:link/link~LinkDecoratorManualDefinition>} manualDecoratorDefinitions
	 */
	_enableManualDecorators( manualDecoratorDefinitions ) {
		if ( !manualDecoratorDefinitions.length ) {
			return;
		}

		const editor = this.editor;
		const command = editor.commands.get( 'link' );
		const manualDecorators = command.manualDecorators;

		manualDecoratorDefinitions.forEach( decorator => {
			editor.model.schema.extend( '$text', { allowAttributes: decorator.id } );

			// Keeps reference to manual decorator to decode its name to attributes during downcast.
			manualDecorators.add( new ManualDecorator( decorator ) );

			editor.conversion.for( 'downcast' ).attributeToElement( {
				model: decorator.id,
				view: ( manualDecoratorName, writer ) => {
					if ( manualDecoratorName ) {
						const attributes = manualDecorators.get( decorator.id ).attributes;
						const element = writer.createAttributeElement( 'a', attributes, { priority: 5 } );
						writer.setCustomProperty( 'link', true, element );

						return element;
					}
				} } );

			editor.conversion.for( 'upcast' ).elementToAttribute( {
				view: {
					name: 'a',
					attributes: manualDecorators.get( decorator.id ).attributes
				},
				model: {
					key: decorator.id
				}
			} );
		} );
	}

	/**
	 * Adds a visual highlight style to a link in which the selection is anchored.
	 * Together with two-step caret movement, they indicate that the user is typing inside the link.
	 *
	 * Highlight is turned on by adding `.ck-link_selected` class to the link in the view:
	 *
	 * * the class is removed before conversion has started, as callbacks added with `'highest'` priority
	 * to {@link module:engine/conversion/downcastdispatcher~DowncastDispatcher} events,
	 * * the class is added in the view post fixer, after other changes in the model tree were converted to the view.
	 *
	 * This way, adding and removing highlight does not interfere with conversion.
	 *
	 * @private
	 */
	_setupLinkHighlight() {
		const editor = this.editor;
		const view = editor.editing.view;
		const highlightedLinks = new Set();

		// Adding the class.
		view.document.registerPostFixer( writer => {
			const selection = editor.model.document.selection;

			if ( selection.hasAttribute( 'linkHref' ) ) {
				const modelRange = findLinkRange( selection.getFirstPosition(), selection.getAttribute( 'linkHref' ), editor.model );
				const viewRange = editor.editing.mapper.toViewRange( modelRange );

				// There might be multiple `a` elements in the `viewRange`, for example, when the `a` element is
				// broken by a UIElement.
				for ( const item of viewRange.getItems() ) {
					if ( item.is( 'a' ) ) {
						writer.addClass( HIGHLIGHT_CLASS, item );
						highlightedLinks.add( item );
					}
				}
			}
		} );

		// Removing the class.
		editor.conversion.for( 'editingDowncast' ).add( dispatcher => {
			// Make sure the highlight is removed on every possible event, before conversion is started.
			dispatcher.on( 'insert', removeHighlight, { priority: 'highest' } );
			dispatcher.on( 'remove', removeHighlight, { priority: 'highest' } );
			dispatcher.on( 'attribute', removeHighlight, { priority: 'highest' } );
			dispatcher.on( 'selection', removeHighlight, { priority: 'highest' } );

			function removeHighlight() {
				view.change( writer => {
					for ( const item of highlightedLinks.values() ) {
						writer.removeClass( HIGHLIGHT_CLASS, item );
						highlightedLinks.delete( item );
					}
				} );
			}
		} );
	}
}
