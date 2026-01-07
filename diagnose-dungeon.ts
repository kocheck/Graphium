#!/usr/bin/env tsx

/**
 * Standalone diagnostic script for DungeonGenerator
 * Tests door generation and grid alignment without needing test framework
 *
 * Usage: npx tsx diagnose-dungeon.ts
 * Requires: tsx package (npx will install it automatically)
 */

import { DungeonGenerator } from './src/utils/DungeonGenerator';

console.log('='.repeat(60));
console.log('DUNGEON GENERATOR DIAGNOSTIC TOOL');
console.log('='.repeat(60));

const gridSize = 50;

try {
  // Create generator
  console.log('\n[1/6] Creating DungeonGenerator...');
  const generator = new DungeonGenerator({
    numRooms: 5,
    gridSize,
  });
  console.log('✅ Generator created with numRooms:', 5);

  // Generate dungeon
  console.log('\n[2/6] Generating dungeon with verbose logging...');

  // Monkey-patch console.log to capture generation logs
  const originalLog = console.log;
  const generationLogs: string[] = [];
  console.log = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('Piece') || msg.includes('door') || msg.includes('Room')) {
      generationLogs.push(msg);
    }
    originalLog(...args);
  };

  const result = generator.generate();

  // Restore console.log
  console.log = originalLog;

  console.log('✅ Generation complete');
  console.log(`  - Wall drawings: ${result.drawings.length}`);
  console.log(`  - Doors: ${result.doors.length}`);
  console.log(`  - Generation logs: ${generationLogs.length} messages`);

  // Show detailed breakdown
  console.log('\n  Detailed breakdown:');
  const wallDrawings = result.drawings.filter((d) => d.tool === 'wall');
  const otherDrawings = result.drawings.filter((d) => d.tool !== 'wall');
  console.log(`    - Wall drawings: ${wallDrawings.length}`);
  console.log(`    - Other drawings: ${otherDrawings.length}`);

  // Analyze wall segments
  console.log('\n  Wall segment analysis:');
  wallDrawings.forEach((wall, i) => {
    const points = wall.points;
    const segmentCount = (points.length - 2) / 2;
    console.log(`    Wall ${i + 1}: ${points.length} points (${segmentCount} segments)`);
  });

  // Check door generation
  console.log('\n[3/6] Checking door generation...');
  if (result.doors.length === 0) {
    console.log('❌ ERROR: No doors generated!');
    console.log('   This means the door generation logic is not working.');
  } else {
    console.log(`✅ Generated ${result.doors.length} doors`);
  }

  // Check grid alignment
  console.log('\n[4/6] Checking grid alignment...');
  const misalignedDoors = result.doors.filter((door) => {
    const xAligned = door.x % gridSize === 0;
    const yAligned = door.y % gridSize === 0;
    return !xAligned || !yAligned;
  });

  if (misalignedDoors.length > 0) {
    console.log(`❌ ERROR: ${misalignedDoors.length} doors are NOT grid-aligned:`);
    misalignedDoors.forEach((door, i) => {
      console.log(`   Door ${i + 1} at (${door.x}, ${door.y}):`);
      console.log(`     - X offset from grid: ${door.x % gridSize}px`);
      console.log(`     - Y offset from grid: ${door.y % gridSize}px`);
      console.log(`     - Orientation: ${door.orientation}`);
    });
  } else {
    console.log(`✅ All ${result.doors.length} doors are grid-aligned!`);
  }

  // Check door properties
  console.log('\n[5/6] Validating door properties...');
  let invalidDoors = 0;
  result.doors.forEach((door, i) => {
    const issues = [];
    if (!door.id) issues.push('missing ID');
    if (typeof door.x !== 'number') issues.push('invalid x position');
    if (typeof door.y !== 'number') issues.push('invalid y position');
    if (!['horizontal', 'vertical'].includes(door.orientation)) issues.push('invalid orientation');
    if (typeof door.isOpen !== 'boolean') issues.push('invalid isOpen state');
    if (typeof door.isLocked !== 'boolean') issues.push('invalid isLocked state');
    if (!door.size || door.size <= 0) issues.push('invalid size');
    if (!door.thickness) issues.push('missing thickness');
    if (!door.swingDirection) issues.push('missing swingDirection');

    if (issues.length > 0) {
      console.log(`   ❌ Door ${i + 1} has issues: ${issues.join(', ')}`);
      invalidDoors++;
    }
  });

  if (invalidDoors === 0) {
    console.log(`✅ All ${result.doors.length} doors have valid properties`);
  } else {
    console.log(`❌ ERROR: ${invalidDoors} doors have invalid properties`);
  }

  // Detailed door info
  console.log('\n[6/6] Detailed door information:');
  console.log('─'.repeat(60));
  result.doors.forEach((door, i) => {
    console.log(`Door ${i + 1}:`);
    console.log(`  Position: (${door.x}, ${door.y})`);
    console.log(`  Orientation: ${door.orientation}`);
    console.log(
      `  State: ${door.isOpen ? 'OPEN' : 'CLOSED'}, ${door.isLocked ? 'LOCKED' : 'UNLOCKED'}`,
    );
    console.log(`  Size: ${door.size}px, Thickness: ${door.thickness}px`);
    console.log(`  Swing: ${door.swingDirection}`);
    console.log(
      `  Grid aligned: X=${door.x % gridSize === 0 ? '✓' : '✗'}, Y=${door.y % gridSize === 0 ? '✓' : '✗'}`,
    );
    console.log('─'.repeat(60));
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Doors generated: ${result.doors.length}`);
  console.log(`Grid-aligned doors: ${result.doors.length - misalignedDoors.length}`);
  console.log(`Misaligned doors: ${misalignedDoors.length}`);
  console.log(`Invalid doors: ${invalidDoors}`);

  if (result.doors.length === 0) {
    console.log('\n❌ CRITICAL: No doors generated! Door generation is broken.');
  } else if (misalignedDoors.length > 0) {
    console.log('\n⚠️  WARNING: Some doors are not grid-aligned.');
  } else if (invalidDoors > 0) {
    console.log('\n⚠️  WARNING: Some doors have invalid properties.');
  } else {
    console.log('\n✅ SUCCESS: All doors are correctly generated and aligned!');
  }

  console.log('='.repeat(60));
} catch (error) {
  console.error('\n❌ FATAL ERROR:');
  console.error(error);
  process.exit(1);
}
