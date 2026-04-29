// Component for analyzing and displaying technical details of font files
import { Stack, Card, Grid, Heading, Text, Button, usePrefersDark, Badge, Flex, Box } from '@sanity/ui'
import { TrashIcon, UploadIcon, CopyIcon, CheckmarkIcon, CloseIcon } from '@sanity/icons'
import { useState } from 'react'
import { ObjectInspector } from "@devtools-ds/object-inspector"
import * as fontkit from 'fontkit'

/**
 * Get Font Data Component
 * Analyzes and displays technical details of font files with multi-font comparison support
 * @param {Object} props - Component props
 * @param {React.Component} props.icon - Icon component to display
 * @param {SanityClient} props.client - Sanity client instance
 * @param {string} props.displayName - Display name for the component heading
 */
const GetFontData = ({ icon: Icon, client, displayName }) => {
	const [fonts, setFonts] = useState([]); // Array of {fontData, fileData}
	const [isDragging, setIsDragging] = useState(false);
	const [copySuccess, setCopySuccess] = useState(false);
	const [viewMode, setViewMode] = useState('single'); // 'single' or 'compare'
	const prefersDark = usePrefersDark();

	const readFontFile = (file) => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (event) => {
				resolve(new Uint8Array(event.target.result));
			};

			reader.onerror = (error) => { reject(error); };
			reader.readAsArrayBuffer(file);
		});
	};

	async function processFile(file) {
		if (!file) return;

		const fontBuffer = await readFontFile(file);
		let font = await fontkit.create(fontBuffer);

		// fix for missing nameId 2 and 17
		font?.fvar?.instance?.forEach( fv =>{
			if(fv?.nameID === 2) fv.name = font?._tables?.name?.records?.fontSubfamily
			if(fv?.nameID === 17) fv.name = font?._tables?.name?.records?.preferredSubfamily
		})

		// Add to fonts array for comparison mode
		setFonts(prev => [...prev, { fontData: font, fileData: file }]);
	}

	async function processMultipleFiles(files) {
		const newFonts = [];
		for (const file of files) {
			const fontBuffer = await readFontFile(file);
			let font = await fontkit.create(fontBuffer);

			// fix for missing nameId 2 and 17
			font?.fvar?.instance?.forEach( fv =>{
				if(fv?.nameID === 2) fv.name = font?._tables?.name?.records?.fontSubfamily
				if(fv?.nameID === 17) fv.name = font?._tables?.name?.records?.preferredSubfamily
			})

			newFonts.push({ fontData: font, fileData: file });
		}
		setFonts(prev => [...prev, ...newFonts]);
	}

	async function readFont(e){
		const files = Array.from(e.target.files);
		if (files.length === 1) {
			await processFile(files[0]);
		} else {
			await processMultipleFiles(files);
		}
	}

	function removeFont(index){
		setFonts(prev => prev.filter((_, i) => i !== index));
		setCopySuccess(false);
	}

	function removeAllFonts() {
		setFonts([]);
		setCopySuccess(false);
	}

	/** Copy metadata to clipboard */
	async function copyMetadata(index = 0) {
		try {
			const data = fonts[index]?.fontData;
			const jsonString = JSON.stringify(data, null, 2);
			await navigator.clipboard.writeText(jsonString);
			setCopySuccess(true);
			// Reset success message after 2 seconds
			setTimeout(() => {
				setCopySuccess(false);
			}, 2000);
		} catch (err) {
			console.error('Failed to copy metadata:', err);
		}
	}

	// Drag and drop handlers
	const handleDragOver = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDrop = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const files = Array.from(e.dataTransfer.files);
		if (files && files.length > 0) {
			if (files.length === 1) {
				await processFile(files[0]);
			} else {
				await processMultipleFiles(files);
			}
		}
	};

	// Click handler for label
	const handleCardClick = () => {
		document.getElementById('file')?.click();
	};

	// Single font data for backward compatibility
	const fontData = fonts[0]?.fontData;
	const fileData = fonts[0]?.fileData;

	// Comparison fields to display
	const comparisonFields = [
		{ label: 'Family Name', key: 'familyName' },
		{ label: 'Style Name', key: 'subfamilyName' },
		{ label: 'Full Name', key: 'fullName' },
		{ label: 'Version', key: 'version' },
		{ label: 'Glyph Count', key: 'numGlyphs' },
		{ label: 'Units Per Em', key: 'unitsPerEm' },
		{ label: 'Ascent', key: 'ascent' },
		{ label: 'Descent', key: 'descent' },
		{ label: 'Line Gap', key: 'lineGap' },
	];

	return (
		<>
			<Stack style={{paddingTop: "4em", paddingBottom: "2em", position: "relative"}}>
				<Heading as="h3" size={3}>{Icon && <Icon style={{display: 'inline-block', marginRight: '0.35em', opacity: 0.5, transform: 'translateY(2px)'}} />}{displayName}</Heading>
				<Text muted size={1} style={{paddingTop: "2em", maxWidth: "calc(100% - 100px)"}}>
					Upload one or more font files to inspect technical metadata, OpenType features, variable font axes, and low-level properties. Upload multiple fonts for side-by-side comparison.
				</Text>
			</Stack>
			<Stack>
				{/* Upload Area */}
				{fonts.length === 0 ? (
					<>
						<div
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onClick={handleCardClick}
							style={{
								cursor: "pointer",
								transition: "all 0.2s ease"
							}}
						>
							<Card
								padding={[5]}
								radius={1}
								shadow={1}
								style={{
									cursor: "pointer",
									border: isDragging ? "2px dashed #4A90E2" : "2px dashed transparent",
									backgroundColor: isDragging ? "rgba(74, 144, 226, 0.1)" : "transparent",
									transition: "all 0.2s ease"
								}}
							>
								<Text align="center">
									<UploadIcon style={{padding:"0 1rem"}}/>
									{isDragging ? "Drop font file(s) here" : "Upload Font(s) (Click or Drag & Drop)"}
								</Text>
								<Text align="center" size={0} muted style={{marginTop: "0.5em"}}>
									Select multiple files for side-by-side comparison
								</Text>
							</Card>
						</div>
						<input
							type="file"
							id="file"
							name="file"
							accept=".ttf,.otf,.woff,.woff2"
							multiple
							style={{display:"none"}}
							onChange={(e)=>{readFont(e)}}
						/>
					</>
				) : (
					<>
						{/* Uploaded Fonts List */}
						<Card padding={3} tone="transparent" border={1}>
							<Flex justify="space-between" align="center" style={{marginBottom: "1em"}}>
								<Heading as="h5" size={1}>
									Uploaded Fonts {fonts.length > 1 && <Badge tone="primary">{fonts.length}</Badge>}
								</Heading>
								<Flex gap={2}>
									<Button
										text="Add More"
										mode="ghost"
										fontSize={1}
										onClick={handleCardClick}
										style={{cursor: "pointer"}}
									/>
									<Button
										text="Clear All"
										mode="ghost"
										tone="critical"
										fontSize={1}
										onClick={removeAllFonts}
										style={{cursor: "pointer"}}
									/>
								</Flex>
							</Flex>
							<Stack space={2}>
								{fonts.map((font, index) => (
									<Card key={index} padding={3} tone="default" style={{position: "relative"}}>
										<Flex justify="space-between" align="center">
											<Text size={1}>{font.fileData.name}</Text>
											<Button
												mode="bleed"
												tone="critical"
												icon={CloseIcon}
												onClick={() => removeFont(index)}
												style={{cursor: "pointer"}}
												padding={2}
											/>
										</Flex>
									</Card>
								))}
							</Stack>
						</Card>
						<input
							type="file"
							id="file"
							name="file"
							accept=".ttf,.otf,.woff,.woff2"
							multiple
							style={{display:"none"}}
							onChange={(e)=>{readFont(e)}}
						/>
					</>
				)}
			</Stack>

			{fonts.length > 0 && (
				<>
					{/* Comparison View Toggle */}
					{fonts.length > 1 && (
						<Stack style={{paddingTop: "1em"}}>
							<Grid columns={[2]} gap={2}>
								<Button
									text="Single View"
									mode={viewMode === 'single' ? 'default' : 'ghost'}
									onClick={() => setViewMode('single')}
									style={{cursor: "pointer"}}
								/>
								<Button
									text="Compare View"
									mode={viewMode === 'compare' ? 'default' : 'ghost'}
									onClick={() => setViewMode('compare')}
									style={{cursor: "pointer"}}
								/>
							</Grid>
						</Stack>
					)}

					{/* Comparison Table View */}
					{viewMode === 'compare' && fonts.length > 1 && (
						<Stack style={{paddingTop: "1em"}}>
							<Card padding={4} tone="transparent" border={1}>
								<Heading as="h5" size={1} style={{paddingBottom: "1em"}}>Font Comparison</Heading>
								<div style={{overflowX: "auto"}}>
									<table style={{width: "100%", borderCollapse: "collapse"}}>
										<thead>
											<tr>
												<th style={{textAlign: "left", padding: "0.5em", borderBottom: "1px solid var(--card-border-color)"}}>
													<Text size={1} weight="semibold">Property</Text>
												</th>
												{fonts.map((font, index) => (
													<th key={index} style={{textAlign: "left", padding: "0.5em", borderBottom: "1px solid var(--card-border-color)"}}>
														<Text size={0} muted>{font.fileData.name}</Text>
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{comparisonFields.map((field) => {
												const values = fonts.map(f => f.fontData[field.key]);
												const allSame = values.every(v => v === values[0]);

												return (
													<tr key={field.key}>
														<td style={{padding: "0.5em", borderBottom: "1px solid var(--card-border-color)"}}>
															<Text size={1}>{field.label}</Text>
														</td>
														{fonts.map((font, index) => {
															const value = font.fontData[field.key];
															const isDifferent = !allSame;
															return (
																<td key={index} style={{
																	padding: "0.5em",
																	borderBottom: "1px solid var(--card-border-color)",
																	backgroundColor: isDifferent ? "rgba(255, 200, 0, 0.1)" : "transparent"
																}}>
																	<Text size={1} muted>{value !== undefined ? String(value) : 'N/A'}</Text>
																</td>
															);
														})}
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</Card>
						</Stack>
					)}

					{/* Single View (original summary cards) */}
					{(viewMode === 'single' || fonts.length === 1) && fonts.map((font, index) => (
						<Stack key={index} style={{paddingTop: "1em"}}>
							<Card padding={4} tone="transparent" border={1}>
								<Flex justify="space-between" align="center" style={{marginBottom: "1em"}}>
									<Heading as="h5" size={1}>
										{font.fileData.name}
									</Heading>
									<Button
										text={copySuccess ? "Copied!" : "Copy Metadata"}
										icon={copySuccess ? CheckmarkIcon : CopyIcon}
										tone={copySuccess ? "positive" : "primary"}
										onClick={() => copyMetadata(index)}
										mode="ghost"
										fontSize={1}
									/>
								</Flex>
								<Grid columns={[2]} gap={3}>
									<Stack space={2}>
										<Text size={1} weight="semibold">Family Name</Text>
										<Text size={1} muted>{font.fontData.familyName || 'N/A'}</Text>
									</Stack>
									<Stack space={2}>
										<Text size={1} weight="semibold">Style Name</Text>
										<Text size={1} muted>{font.fontData.subfamilyName || 'N/A'}</Text>
									</Stack>
									<Stack space={2}>
										<Text size={1} weight="semibold">Glyph Count</Text>
										<Text size={1} muted>{font.fontData.numGlyphs || 'N/A'}</Text>
									</Stack>
									<Stack space={2}>
										<Text size={1} weight="semibold">Version</Text>
										<Text size={1} muted>{font.fontData.version || 'N/A'}</Text>
									</Stack>
								</Grid>
							</Card>

							{/* Object Inspector for detailed view */}
							<Card padding={[5]} radius={1} shadow={1}>
								<style dangerouslySetInnerHTML={{__html: `
									.object-inspector {
										overflow: scroll;
										max-height: 400px;
									}
									.object-inspector > ul > li > ul > li {
										padding-bottom: 1em;
									}
									[class^="ObjectInspector-prototype"] {
										opacity: 0.5;
									}
									.object-inspector > ul > li > ul > * > * > * > * > * > [class^="ObjectInspector-key"]:first-child {
										filter: saturate(100);
									}
								`}}></style>
								<ObjectInspector
									data={font.fontData || {}}
									className='object-inspector'
									expandLevel={1}
									sortKeys={true}
									theme="chrome"
									colorScheme={ prefersDark ? "dark" : "light" }
								/>
							</Card>
						</Stack>
					))}
				</>
			)}
		</>
	)
}

export default GetFontData
