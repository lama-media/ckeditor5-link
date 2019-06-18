/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module link/ui/linkformview
 */

import View from '@ckeditor/ckeditor5-ui/src/view';
import ViewCollection from '@ckeditor/ckeditor5-ui/src/viewcollection';

import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import SwitchButtonView from '@ckeditor/ckeditor5-ui/src/button/switchbuttonview';
import LabeledInputView from '@ckeditor/ckeditor5-ui/src/labeledinput/labeledinputview';
import InputTextView from '@ckeditor/ckeditor5-ui/src/inputtext/inputtextview';

import submitHandler from '@ckeditor/ckeditor5-ui/src/bindings/submithandler';
import FocusTracker from '@ckeditor/ckeditor5-utils/src/focustracker';
import FocusCycler from '@ckeditor/ckeditor5-ui/src/focuscycler';
import KeystrokeHandler from '@ckeditor/ckeditor5-utils/src/keystrokehandler';

import checkIcon from '@ckeditor/ckeditor5-core/theme/icons/check.svg';
import cancelIcon from '@ckeditor/ckeditor5-core/theme/icons/cancel.svg';
import '../../theme/linkform.css';

/**
 * The link form view controller class.
 *
 * See {@link module:link/ui/linkformview~LinkFormView}.
 *
 * @extends module:ui/view~View
 */
export default class LinkFormView extends View {
	/**
	 * Creates an instance of the {@link module:link/ui/linkformview~LinkFormView} class.
	 *
	 * Also see {@link #render}.
	 *
	 * @param {module:utils/locale~Locale} [locale] The localization services instance.
	 * @param {module:utils/collection~Collection} [manualDecorators] Reference to custom attributes in
	 * {@link module:link/linkcommand~LinkCommand#manualDecorators}.
	 */
	constructor( locale, manualDecorators ) {
		super( locale );

		const t = locale.t;

		/**
		 * Tracks information about DOM focus in the form.
		 *
		 * @readonly
		 * @member {module:utils/focustracker~FocusTracker}
		 */
		this.focusTracker = new FocusTracker();

		/**
		 * An instance of the {@link module:utils/keystrokehandler~KeystrokeHandler}.
		 *
		 * @readonly
		 * @member {module:utils/keystrokehandler~KeystrokeHandler}
		 */
		this.keystrokes = new KeystrokeHandler();

		/**
		 * The URL input view.
		 *
		 * @member {module:ui/labeledinput/labeledinputview~LabeledInputView}
		 */
		this.urlInputView = this._createUrlInput();

		/**
		 * The Save button view.
		 *
		 * @member {module:ui/button/buttonview~ButtonView}
		 */
		this.saveButtonView = this._createButton( t( 'Save' ), checkIcon, 'ck-button-save' );
		this.saveButtonView.type = 'submit';

		/**
		 * The Cancel button view.
		 *
		 * @member {module:ui/button/buttonview~ButtonView}
		 */
		this.cancelButtonView = this._createButton( t( 'Cancel' ), cancelIcon, 'ck-button-cancel', 'cancel' );

		/**
		 * A reference to {@link module:link/linkcommand~LinkCommand#manualDecorators manual decorators}
		 * collection of the {@link module:link/linkcommand~LinkCommand}.
		 *
		 * Helps bootstrap the {@link #manualDecoratorsUIView UI} so it corresponds with the global
		 * configuration of manual decorators and to synchronize its state later on when the user
		 * is editing the content.
		 *
		 * @readonly
		 * @type {model:utils/collection~Collection}
		 */
		this.manualDecorators = manualDecorators;

		/**
		 * A collection of {@link module:ui/button/switchbuttonview~SwitchButtonView},
		 * which corresponds to {@link #manualDecorators manual decorators} configured in the editor.
		 * Populated by {@link #_createManualDecoratorsUIView}.
		 *
		 * @private
		 * @readonly
		 * @type {module:ui/viewcollection~ViewCollection}
		 */
		this._manualDecoratorSwitches = this._createManualDecoratorSwitches();

		/**
		 * Collection of child views in the form.
		 *
		 * @readonly
		 * @type {module:ui/viewcollection~ViewCollection}
		 */
		this.children = this._createFormChildren();

		/**
		 * A collection of views which can be focused in the form.
		 *
		 * @readonly
		 * @protected
		 * @member {module:ui/viewcollection~ViewCollection}
		 */
		this._focusables = new ViewCollection();

		/**
		 * Helps cycling over {@link #_focusables} in the form.
		 *
		 * @readonly
		 * @protected
		 * @member {module:ui/focuscycler~FocusCycler}
		 */
		this._focusCycler = new FocusCycler( {
			focusables: this._focusables,
			focusTracker: this.focusTracker,
			keystrokeHandler: this.keystrokes,
			actions: {
				// Navigate form fields backwards using the Shift + Tab keystroke.
				focusPrevious: 'shift + tab',

				// Navigate form fields forwards using the Tab key.
				focusNext: 'tab'
			}
		} );

		const classList = [ 'ck', 'ck-link-form' ];

		if ( this.manualDecorators.length ) {
			classList.push( 'ck-link-form_layout-vertical' );
		}

		this.setTemplate( {
			tag: 'form',

			attributes: {
				class: classList,

				// https://github.com/ckeditor/ckeditor5-link/issues/90
				tabindex: '-1'
			},

			children: this.children
		} );
	}

	/**
	 * Obtain state of the switch buttons in a currently opened {@link module:link/ui/linkformview~LinkFormView}.
	 *
	 * @returns {Object} key-value pairs, where key is the name of the decorator and value is its state.
	 */
	getDecoratorSwitchesState() {
		return Array.from( this._manualDecoratorSwitches ).reduce( ( accumulator, switchButton ) => {
			accumulator[ switchButton.name ] = switchButton.isOn;
			return accumulator;
		}, {} );
	}

	/**
	 * @inheritDoc
	 */
	render() {
		super.render();

		submitHandler( {
			view: this
		} );

		const childViews = [
			this.urlInputView,
			...this._manualDecoratorSwitches,
			this.saveButtonView,
			this.cancelButtonView
		];

		childViews.forEach( v => {
			// Register the view as focusable.
			this._focusables.add( v );

			// Register the view in the focus tracker.
			this.focusTracker.add( v.element );
		} );

		// Start listening for the keystrokes coming from #element.
		this.keystrokes.listenTo( this.element );
	}

	/**
	 * Focuses the fist {@link #_focusables} in the form.
	 */
	focus() {
		this._focusCycler.focusFirst();
	}

	/**
	 * Creates a labeled input view.
	 *
	 * @private
	 * @returns {module:ui/labeledinput/labeledinputview~LabeledInputView} Labeled input view instance.
	 */
	_createUrlInput() {
		const t = this.locale.t;

		const labeledInput = new LabeledInputView( this.locale, InputTextView );

		labeledInput.label = t( 'Link URL' );
		labeledInput.inputView.placeholder = 'https://example.com';

		return labeledInput;
	}

	/**
	 * Creates a button view.
	 *
	 * @private
	 * @param {String} label The button label.
	 * @param {String} icon The button's icon.
	 * @param {String} className The additional button CSS class name.
	 * @param {String} [eventName] An event name that the `ButtonView#execute` event will be delegated to.
	 * @returns {module:ui/button/buttonview~ButtonView} The button view instance.
	 */
	_createButton( label, icon, className, eventName ) {
		const button = new ButtonView( this.locale );

		button.set( {
			label,
			icon,
			tooltip: true
		} );

		button.extendTemplate( {
			attributes: {
				class: className
			}
		} );

		if ( eventName ) {
			button.delegate( 'execute' ).to( this, eventName );
		}

		return button;
	}

	/**
	 * Populates {@link module:ui/viewcollection~ViewCollection} of {@link module:ui/button/switchbuttonview~SwitchButtonView}
	 * made based on {@link #manualDecorators}
	 *
	 * @private
	 * @returns {module:ui/viewcollection~ViewCollection} of Switch Buttons.
	 */
	_createManualDecoratorSwitches() {
		const switches = this.createCollection();

		switches.bindTo( this.manualDecorators ).using( item => {
			const switchButton = new SwitchButtonView( this.locale );

			switchButton.set( {
				name: item.id,
				label: item.label,
				withText: true
			} );

			switchButton.bind( 'isOn' ).to( item, 'value' );

			switchButton.on( 'execute', () => {
				item.set( 'value', !switchButton.isOn );
			} );

			return switchButton;
		} );

		return switches;
	}

	/**
	 * Populates the {@link #children} collection of the form.
	 *
	 * If {@link #manualDecorators manual decorators} are configured in the editor, creates an
	 * additional `View` wrapping all {@link #manualDecoratorsUIView} switch buttons corresponding
	 * to those decorators.
	 *
	 * @private
	 * @returns {module:ui/viewcollection~ViewCollection} children of LinkFormView.
	 */
	_createFormChildren() {
		const children = this.createCollection();

		children.add( this.urlInputView );

		if ( this.manualDecorators.length ) {
			const additionalButtonsView = new View();

			additionalButtonsView.setTemplate( {
				tag: 'ul',
				children: this._manualDecoratorSwitches.map( switchButton => ( {
					tag: 'li',
					children: [ switchButton ],
					attributes: {
						class: [
							'ck',
							'ck-list__item'
						]
					}
				} ) ),
				attributes: {
					class: [
						'ck',
						'ck-reset',
						'ck-list'
					]
				}
			} );
			children.add( additionalButtonsView );
		}

		children.add( this.saveButtonView );
		children.add( this.cancelButtonView );

		return children;
	}
}

/**
 * Fired when the form view is submitted (when one of the children triggered the submit event),
 * e.g. click on {@link #saveButtonView}.
 *
 * @event submit
 */

/**
 * Fired when the form view is canceled, e.g. click on {@link #cancelButtonView}.
 *
 * @event cancel
 */
