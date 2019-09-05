/**
 * External dependencies
 */
import classnames from 'classnames';
import { forEach, find, difference } from 'lodash';

/**
 * WordPress dependencies
 */
import {
	InnerBlocks,
	BlockControls,
	BlockVerticalAlignmentToolbar,
	InspectorControls,
} from '@wordpress/block-editor';
import { PanelBody, RangeControl } from '@wordpress/components';
import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	toWidthPrecision,
	getTotalColumnsWidth,
	getColumnWidths,
	getAdjacentBlocks,
	getRedistributedColumnWidths,
} from '../columns/utils';

function ColumnEdit( {
	attributes,
	className,
	updateAlignment,
	updateWidth,
	hasChildBlocks,
	columnsParentLock,
} ) {
	const { verticalAlignment, width } = attributes;

	const classes = classnames(
		className,
		'block-core-columns',
		{
			[ `is-vertically-aligned-${ verticalAlignment }` ]: verticalAlignment,
		}
	);

	return (
		<div className={ classes }>
			<BlockControls>
				<BlockVerticalAlignmentToolbar
					onChange={ updateAlignment }
					value={ verticalAlignment }
				/>
			</BlockControls>
			<InspectorControls>
				<PanelBody title={ __( 'Column Settings' ) }>
					<RangeControl
						label={ __( 'Percentage width' ) }
						value={ width || '' }
						onChange={ updateWidth }
						min={ 0 }
						max={ 100 }
						required
						allowReset
					/>
				</PanelBody>
			</InspectorControls>
			<InnerBlocks
				// It is safe to set an "inherited" locking explicitly because no
				// template is set on the column. If a template was set and parent lock
				// was equal to "all" the local template set would be forced and other
				// templates passed e.g via CPT would be ignored.
				templateLock={ columnsParentLock }
				renderAppender={ (
					hasChildBlocks ?
						undefined :
						() => <InnerBlocks.ButtonBlockAppender />
				) }
			/>
		</div>
	);
}

export default compose(
	withSelect( ( select, ownProps ) => {
		const { clientId } = ownProps;
		const {
			getBlockOrder,
			getBlockRootClientId,
			getTemplateLock,
		} = select( 'core/block-editor' );

		const parentColumnsId = getBlockRootClientId( clientId );
		const parentOfColumnsId = getBlockRootClientId( parentColumnsId );
		const columnsParentLock = parentOfColumnsId ? getTemplateLock( parentOfColumnsId ) : getTemplateLock();

		return {
			hasChildBlocks: getBlockOrder( clientId ).length > 0,
			columnsParentLock: columnsParentLock !== undefined ? columnsParentLock : false,
		};
	} ),
	withDispatch( ( dispatch, ownProps, registry ) => {
		return {
			updateAlignment( verticalAlignment ) {
				const { clientId, setAttributes } = ownProps;
				const { updateBlockAttributes } = dispatch( 'core/block-editor' );
				const { getBlockRootClientId } = registry.select( 'core/block-editor' );

				// Update own alignment.
				setAttributes( { verticalAlignment } );

				// Reset Parent Columns Block
				const rootClientId = getBlockRootClientId( clientId );
				updateBlockAttributes( rootClientId, { verticalAlignment: null } );
			},
			updateWidth( width ) {
				const { clientId } = ownProps;
				const { updateBlockAttributes } = dispatch( 'core/block-editor' );
				const { getBlockRootClientId, getBlocks } = registry.select( 'core/block-editor' );

				// Constrain or expand siblings to account for gain or loss of
				// total columns area.
				const columns = getBlocks( getBlockRootClientId( clientId ) );
				const adjacentColumns = getAdjacentBlocks( columns, clientId );

				// The occupied width is calculated as the sum of the new width
				// and the total width of blocks _not_ in the adjacent set.
				const occupiedWidth = width + getTotalColumnsWidth(
					difference( columns, [
						find( columns, { clientId } ),
						...adjacentColumns,
					] )
				);

				// Compute _all_ next column widths, in case the updated column
				// is in the middle of a set of columns which don't yet have
				// any explicit widths assigned (include updates to those not
				// part of the adjacent blocks).
				const nextColumnWidths = {
					...getColumnWidths( columns, columns.length ),
					[ clientId ]: toWidthPrecision( width ),
					...getRedistributedColumnWidths( adjacentColumns, 100 - occupiedWidth, columns.length ),
				};

				forEach( nextColumnWidths, ( nextColumnWidth, columnClientId ) => {
					updateBlockAttributes( columnClientId, { width: nextColumnWidth } );
				} );
			},
		};
	} )
)( ColumnEdit );
