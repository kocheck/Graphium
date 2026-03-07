/**
 * 🎲 THE SPELLBOOK OF SYSTEM MESSAGES
 *
 * A centralized repository of all system messages with randomized variations.
 * Each message intent has 5-10 variations written in the "Digital Dungeon Master" persona.
 *
 * Usage: rollForMessage('CAMPAIGN_SAVE_SUCCESS')
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// eslint-disable-next-line import/no-unused-modules
export type MessageIntent =
  // Toast: Success Messages
  | 'CAMPAIGN_SAVE_SUCCESS'
  | 'CAMPAIGN_LOAD_SUCCESS'
  | 'ASSET_DELETED_SUCCESS'
  | 'ASSET_ADDED_TO_MAP_SUCCESS'
  | 'ASSET_ADDED_TO_LIBRARY_SUCCESS'

  // Toast: Error Messages
  | 'CANNOT_DELETE_ONLY_MAP'
  | 'PAUSE_TOGGLE_FAILED'
  | 'CAMPAIGN_SAVE_FAILED'
  | 'CAMPAIGN_LOAD_FAILED'
  | 'MAP_IMAGE_PROCESS_FAILED'
  | 'MAP_IMAGE_LOAD_FAILED'
  | 'MAP_UPLOAD_FAILED'
  | 'TOKEN_UPLOAD_FAILED'
  | 'PROCESSED_IMAGE_READ_FAILED'
  | 'IMAGE_PROCESS_FAILED'
  | 'ASSET_DELETE_FAILED'
  | 'LIBRARY_NAME_REQUIRED'
  | 'LIBRARY_IMAGE_DATA_MISSING'
  | 'LIBRARY_SAVE_FAILED'
  | 'LIBRARY_UPDATE_FAILED'
  | 'PAUSE_STATE_SYNC_FAILED'

  // Confirmation Dialogs
  | 'CONFIRM_TOKEN_REMOVAL'
  | 'CONFIRM_MAP_DELETE'
  | 'CONFIRM_LIBRARY_ASSET_DELETE'

  // Loading States
  | 'LOADING_PAUSE_OVERLAY'
  | 'LOADING_ERROR_REPORT'

  // Error Boundary Messages
  | 'ERROR_DUNGEON_GENERATION_TITLE'
  | 'ERROR_DUNGEON_GENERATION_DESC'
  | 'ERROR_PRIVACY_TITLE'
  | 'ERROR_PRIVACY_DESC'
  | 'ERROR_ASSET_PROCESSING_TITLE'
  | 'ERROR_ASSET_PROCESSING_DESC';

// ============================================================================
// MESSAGE POOLS
// ============================================================================

const messageSpellbook: Record<MessageIntent, string[]> = {
  // ==========================================================================
  // 🎉 SUCCESS MESSAGES - Natural 20s, Level Ups, and Victorious Moments
  // ==========================================================================

  CAMPAIGN_SAVE_SUCCESS: [
    '⚔️ Your deeds have been inscribed into the Chronicle of Legends!',
    '🎲 Natural 20 on that Arcana check! Campaign saved successfully.',
    '📜 The scribes have recorded your progress. Adventure onwards!',
    '✨ *Casting Preserve Timeline...* Success! Your campaign is secure.',
    '🛡️ Checkpoint saved. The gods smile upon your preparation.',
    "🏰 Your kingdom's state has been preserved in the Astral Archives.",
    "💾 Campaign data committed to the ethereal plane. You're good to go!",
  ],

  CAMPAIGN_LOAD_SUCCESS: [
    '📖 The ancient tome opens! Your campaign has been restored.',
    '🎲 *Rolling for timeline restoration...* Success! Welcome back, adventurer.',
    '✨ The mists of time part—your world materializes before you.',
    '🗺️ Campaign loaded from the Vault of Chronicles. Your quest continues!',
    '🔮 Divination complete. Your saved realm now manifests.',
    '⏳ Time magic succeeded! Returning you to your last checkpoint...',
    '🌟 The cosmos aligns—your campaign is restored and ready for adventure!',
  ],

  ASSET_DELETED_SUCCESS: [
    '🗑️ Asset banished to the void. The library has been cleansed.',
    '⚔️ Critical hit! Asset successfully removed from existence.',
    '✨ *Poof!* The asset vanishes in a cloud of arcane smoke.',
    '📦 Item deleted. May it rest in the digital afterlife.',
    '🎲 Rolled for deletion... Nat 20! Asset obliterated.',
    '🔥 Asset consumed by dragon fire. It is no more.',
    '💀 Asset has been sent to the Shadow Realm. Farewell, old friend.',
  ],

  ASSET_ADDED_TO_MAP_SUCCESS: [
    '🎯 {itemName} materializes on the battlefield!',
    '✨ Summoning successful! {itemName} has entered the fray.',
    '🎲 *Rolling for conjuration...* {itemName} appears on the map!',
    '📍 {itemName} deployed. Initiative: Your turn!',
    '🗺️ {itemName} added to the tactical grid. Position confirmed.',
    '⚔️ {itemName} joins the encounter. Roll for initiative!',
    '🌟 The ritual completes—{itemName} now occupies the map!',
  ],

  ASSET_ADDED_TO_LIBRARY_SUCCESS: [
    '📚 Asset catalogued! Your library grows in power.',
    '✨ New entry added to the Codex of Assets. Knowledge is power!',
    '🎲 *Rolling to archive...* Success! Library updated.',
    '📖 The librarians rejoice—your collection expands!',
    '🏛️ Asset preserved in the Grand Repository. Well done!',
    '💎 A worthy addition to your treasure hoard of assets!',
    '⭐ Library enhanced. Your arsenal of creativity strengthens!',
  ],

  // ==========================================================================
  // ❌ ERROR MESSAGES - Critical Fails, Fizzled Spells, and Cursed Attempts
  // ==========================================================================

  CANNOT_DELETE_ONLY_MAP: [
    '⚠️ Hold, adventurer! You cannot destroy your only map. The void awaits no one.',
    '🛡️ A protective ward prevents deletion. At least one map must remain.',
    '🎲 Critical fail on deletion check. You need at least one map to continue your quest!',
    '❌ The cosmos refuses. Deleting your last map would tear the fabric of reality.',
    '🗺️ Cannot proceed: A campaign without maps is like a dungeon without doors.',
    '⛔ The last map is sacred. Create another before banishing this one to oblivion.',
    '🔮 Divination prevents this action. Your world needs at least one map to exist.',
  ],

  PAUSE_TOGGLE_FAILED: [
    '⚠️ The pause ritual fizzled. Please try the incantation again.',
    '🎲 Rolled a 1 on the pause check. IPC communication interrupted.',
    '❌ Failed to toggle time itself. The fabric of reality resists.',
    '⏸️ Pause spell backfired. Try reweaving the temporal threads.',
    '🔮 Communication with the time mage failed. Retry the pause toggle?',
    '💥 Pause state synchronization disrupted. Roll again, Dungeon Master.',
  ],

  CAMPAIGN_SAVE_FAILED: [
    '💀 Critical failure! Your campaign could not be saved: {error}',
    '🎲 Rolled a 1 on Preservation. Save failed: {error}',
    '❌ The scribes dropped their quills! Save error: {error}',
    '📜 The Chronicle rejects your inscription: {error}',
    '⚠️ Save spell interrupted by arcane interference: {error}',
    '🔥 The save ritual was consumed by chaos: {error}',
    '💥 Campaign save collapsed under mysterious forces: {error}',
  ],

  CAMPAIGN_LOAD_FAILED: [
    '📖 The tome is sealed! Failed to load campaign: {error}',
    '🎲 Load check failed catastrophically: {error}',
    '❌ Timeline restoration interrupted: {error}',
    '🔮 Divination into the past failed: {error}',
    '⏳ Time magic misfired. Load error: {error}',
    '💀 Your saved world is unreachable: {error}',
    '⚠️ The vault refuses to open: {error}',
  ],

  MAP_IMAGE_PROCESS_FAILED: [
    '❌ The map scroll appears corrupted or enchanted beyond recognition.',
    '🗺️ Map processing ritual failed. The cartographer is confused by this file.',
    '🎲 Critical miss on image parsing. File may be invalid or unsupported.',
    '⚠️ The arcane scanner cannot decipher this map format.',
    '🔮 Image divination failed. This scroll is illegible to our systems.',
    '💀 Map processing perished. The file may be cursed or in an unknown format.',
    '🔥 The processing ritual was consumed. Please verify your image file.',
  ],

  MAP_IMAGE_LOAD_FAILED: [
    '🗺️ The map refuses to manifest. Check the file format and try again.',
    '🎲 Failed perception check: Cannot load this image format.',
    '❌ Map materialization failed. Is this truly an image scroll?',
    '⚠️ The cartographer cannot read this parchment. File format unclear.',
    '🔮 Image summoning spell fizzled. Verify file integrity and retry.',
    '💥 Map load interrupted. The file may be damaged or incompatible.',
  ],

  MAP_UPLOAD_FAILED: [
    '❌ Critical miss! The map scroll appears to be cursed or illegible.',
    "🎲 Rolled a 1 on Perception. This file isn't recognized as a valid map.",
    '🗺️ The cartographer refuses to work with this parchment. Try another image format?',
    '⚠️ Map upload ritual interrupted. The file may be corrupted or enchanted.',
    '🔮 Divination failed: Not a valid image format. The spirits are confused.',
    "💀 Your map upload has perished. Please ensure it's a proper image file (.jpg, .png, .webp).",
  ],

  TOKEN_UPLOAD_FAILED: [
    '⚔️ Token summoning failed! The file may be corrupted.',
    '🎲 Rolled a 1 on conjuration. Token upload interrupted.',
    '❌ The token refuses to materialize. File upload failed.',
    '⚠️ Summoning ritual backfired. Cannot upload this token.',
    '🔮 Token materialization fizzled. Try a different image file.',
    '💀 Token upload perished in the void. Please try again.',
  ],

  PROCESSED_IMAGE_READ_FAILED: [
    '🔮 Cannot divine the processed image data. Arcane storage error.',
    '❌ The processed scroll is unreadable. Internal error detected.',
    '⚠️ Image processing completed, but retrieval failed. Storage curse?',
    '💥 Failed to read the enchanted image from the vault.',
    '🎲 Critical failure reading processed data. The file vanished!',
  ],

  IMAGE_PROCESS_FAILED: [
    '🔮 Image processing spell fizzled. The arcane engine is confused.',
    '❌ The transmutation ritual failed. Cannot process this image.',
    '⚠️ Processing interrupted by mysterious forces. File may be unstable.',
    '💥 Image alchemy failed. The file resists transformation.',
    '🎲 Rolled a 1 on image processing. Technical error occurred.',
    '🔥 The processing ritual was consumed by chaos. Try again?',
  ],

  ASSET_DELETE_FAILED: [
    '⚠️ The asset resists banishment! Deletion failed.',
    '🎲 Critical miss on the deletion roll. Asset remains in library.',
    '❌ Failed to purge asset. It clings to existence.',
    '💀 Asset deletion interrupted by protective wards.',
    '🔮 Banishment spell fizzled. The asset endures.',
  ],

  LIBRARY_NAME_REQUIRED: [
    '📝 Hold! Every artifact needs a name, adventurer.',
    '⚠️ The librarians demand a name for cataloguing purposes.',
    '🎲 Failed charisma check: Please enter a name for this asset.',
    '❌ Unnamed assets cannot enter the Grand Library. Name required!',
    '📚 The Codex refuses nameless entries. Please provide a title.',
  ],

  LIBRARY_IMAGE_DATA_MISSING: [
    '🖼️ The image data has vanished into the void! Nothing to save.',
    '❌ No image detected. Did the asset slip through a portal?',
    '⚠️ Image data missing. The file may have been consumed by the Abyss.',
    '🔮 Cannot find image data. Divination returns... nothing.',
    '💀 The image exists not. Data unavailable for archival.',
  ],

  LIBRARY_SAVE_FAILED: [
    '📚 The library rejects this entry! Save failed.',
    '🎲 Critical failure on archival attempt. Cannot save to library.',
    '❌ Failed to inscribe asset into the Codex. Storage error.',
    '⚠️ Library save interrupted by arcane interference.',
    '🔥 The archival ritual collapsed. Asset not saved.',
  ],

  LIBRARY_UPDATE_FAILED: [
    '📝 The scribes failed to update the record. Changes lost.',
    '❌ Failed to modify the asset metadata. The library resists change.',
    '⚠️ Update spell fizzled. The asset remains unchanged.',
    '💀 Critical failure on revision. Metadata update failed.',
    '🔮 The Codex rejects your amendments. Try again?',
  ],

  PAUSE_STATE_SYNC_FAILED: [
    '⏸️ Time synchronization failed! Reality flickers uncertainly.',
    '🎲 Pause state desynchronized. The timeline is unstable!',
    '❌ Failed to sync pause across dimensions. IPC error.',
    '⚠️ Temporal magic misfired. Pause state uncertain.',
    '🔮 Communication with the time realm failed. Pause sync error.',
  ],

  // ==========================================================================
  // 🛡️ CONFIRMATION DIALOGS - "Are You Certain?" Moments
  // ==========================================================================

  CONFIRM_TOKEN_REMOVAL: [
    '⚔️ Remove this token from your personal armory?',
    '🗑️ Banish this token to the void? This action cannot be undone.',
    '⚠️ Are you certain you wish to delete this token from your library?',
    '💀 Send this token to the Shadow Realm?',
    '🎲 Remove from library? Roll for confirmation.',
    '❌ Delete this token permanently?',
  ],

  CONFIRM_MAP_DELETE: [
    '⚠️ Destroy map "{mapName}"? This realm will be lost forever.',
    '🗺️ Are you certain you wish to delete "{mapName}"? The void awaits.',
    '💀 Banish "{mapName}" to oblivion? This cannot be undone.',
    '🎲 Delete "{mapName}"? Critical decision—there\'s no going back.',
    '🔥 Erase "{mapName}" from existence? Proceed with caution.',
    '❌ Remove "{mapName}" permanently? The cosmos will not remember it.',
  ],

  CONFIRM_LIBRARY_ASSET_DELETE: [
    '🗑️ Delete "{assetName}" from the Grand Library? Gone forever.',
    '⚔️ Remove "{assetName}" from your collection? This cannot be undone.',
    '💀 Banish "{assetName}" to the digital afterlife?',
    '⚠️ Are you sure you want to delete "{assetName}"? No resurrection available.',
    '🎲 Permanently remove "{assetName}"? Roll for final confirmation.',
    '❌ Erase "{assetName}" from the Codex? The librarians won\'t approve...',
  ],

  // ==========================================================================
  // ⏳ LOADING STATES - Consulting Archives, Rolling Initiative, Summoning
  // ==========================================================================

  LOADING_PAUSE_OVERLAY: [
    '⏸️ The Dungeon Master is preparing the next scene...',
    '🎲 Rolling for random encounter... Please stand by.',
    '✨ Consulting the ancient scrolls. One moment, adventurer...',
    '🔮 Divination in progress. The spirits are being consulted...',
    '📖 The DM is reviewing their notes. Patience, brave hero...',
    '⏳ Time stands still as the world is prepared for your return...',
    "🌙 The realm sleeps. Awaiting the Dungeon Master's signal...",
  ],

  LOADING_ERROR_REPORT: [
    '🔍 Sanitizing error data for privacy...',
    '🛡️ Preparing error report (personal info redacted)...',
    '📋 Compiling diagnostic scrolls...',
    '🔮 Divining the cause of failure...',
    '⚙️ Analyzing the arcane malfunction...',
  ],

  // ==========================================================================
  // 💀 ERROR BOUNDARY MESSAGES - When Things Go Catastrophically Wrong
  // ==========================================================================

  ERROR_DUNGEON_GENERATION_TITLE: [
    '💀 Dungeon Generation Ritual Failed',
    '⚠️ Procedural Generation Error',
    '🎲 Critical Failure: Dungeon Creation',
    '❌ The Dungeon Collapsed During Construction',
    '🔮 Dungeon Generation Spell Fizzled',
  ],

  ERROR_DUNGEON_GENERATION_DESC: [
    'The procedural generation ritual encountered an obstacle. This typically occurs when:',
    'Something went awry during dungeon creation. Common culprits include:',
    'The dungeon generator encountered insurmountable constraints. Possible causes:',
    'Dungeon generation failed due to conflicting parameters. Check if:',
    "The architect's blueprints were rejected by reality. This can happen when:",
  ],

  ERROR_PRIVACY_TITLE: [
    '💥 Something Went Wrong',
    '⚠️ An Unexpected Error Occurred',
    '❌ Critical System Failure',
    '💀 The Application Encountered an Error',
    '🔮 Reality Hiccupped—Error Detected',
  ],

  ERROR_PRIVACY_DESC: [
    "We're sorry, adventurer, but something unexpected happened. The error details below have been sanitized to protect your privacy.",
    "An arcane malfunction has occurred. Don't worry—your personal information has been redacted from this error report.",
    'The application stumbled. Error details are shown below (username and file paths have been replaced with <USER> for privacy).',
    'Something broke in the code realm. Rest assured, any personal data has been scrubbed from this report.',
    "Apologies for the inconvenience! An error occurred, but we've ensured your privacy by sanitizing all personal details.",
  ],

  ERROR_ASSET_PROCESSING_TITLE: [
    '❌ Asset Processing Ritual Failed',
    '⚠️ File Processing Error',
    '💀 Asset Upload Interrupted',
    '🔮 Image Processing Spell Fizzled',
    '💥 Failed to Process Uploaded Asset',
  ],

  ERROR_ASSET_PROCESSING_DESC: [
    'The asset processing ritual was interrupted. This might happen if:',
    'Failed to process your uploaded file. Common reasons include:',
    'The image transmutation spell failed. Potential causes:',
    'Asset processing encountered an obstacle. Check if:',
    'Your file could not be processed. This typically occurs when:',
  ],
};

// ============================================================================
// UTILITY FUNCTION: THE MESSAGE RANDOMIZER
// ============================================================================

/**
 * 🎲 ROLL FOR MESSAGE
 *
 * Randomly selects one message from the pool for a given intent.
 * If the intent is not found, returns a fallback message.
 *
 * @param intent - The message intent key
 * @param replacements - Optional object for dynamic string replacement (e.g., {itemName: "Dragon"})
 * @returns A randomly selected message string
 *
 * @example
 * rollForMessage('CAMPAIGN_SAVE_SUCCESS')
 * // Returns: "⚔️ Your deeds have been inscribed into the Chronicle of Legends!"
 *
 * @example
 * rollForMessage('ASSET_ADDED_TO_MAP_SUCCESS', { itemName: 'Red Dragon' })
 * // Returns: "✨ Summoning successful! Red Dragon has entered the fray."
 */
export function rollForMessage(
  intent: MessageIntent,
  replacements?: Record<string, string>,
): string {
  const messages = messageSpellbook[intent];

  if (!messages || messages.length === 0) {
    console.warn(`[Spellbook] No messages found for intent: ${intent}`);
    return '✨ The message scroll is blank. Please report this to the archmage.';
  }

  // Roll the dice! (Random selection)
  const randomIndex = Math.floor(Math.random() * messages.length);
  let selectedMessage = messages[randomIndex] ?? '';

  // Apply dynamic replacements if provided (e.g., {error}, {mapName}, {itemName})
  if (replacements) {
    Object.entries(replacements).forEach(([key, value]) => {
      // Use regex with global flag for ES2020 compatibility (replaceAll requires ES2021)
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      selectedMessage = selectedMessage.replace(regex, value);
    });
  }

  return selectedMessage;
}
