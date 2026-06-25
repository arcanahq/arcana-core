// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BackupRegistry
 * @notice Stores only the latest backup per user.
 * @dev Submitting a backup overwrites any previous backup for that user.
 *
 * ACCESS CONTROL DESIGN:
 * - Users can ONLY submit backups for themselves (msg.sender)
 * - Users CANNOT overwrite or modify other users' backups
 * - All backup submissions are indexed by msg.sender's address
 * - Reading backup data is permissionless (anyone can read any backup)
 */
contract BackupRegistry {
    struct BackupEntry {
        bytes32 backupId;
        string ipfsHash;
        uint256 timestamp;
    }

    mapping(address => BackupEntry) private latestBackups;

    event BackupSubmitted(address indexed user, bytes32 indexed backupId, string ipfsHash, uint256 timestamp);

    constructor() {
        // No constructor parameters needed - anyone can use this registry
    }

    /**
     * @notice Submit a new backup IPFS hash
     * @dev ACCESS CONTROL: Only msg.sender can submit their own backup.
     *      Users cannot submit backups for other addresses.
     *      Each backup submission overwrites the previous backup for that user.
     * @param backupId Unique identifier for this backup (bytes32)
     * @param ipfsHash IPFS hash of the encrypted backup file
     */
    function submitBackup(bytes32 backupId, string calldata ipfsHash) external {
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(backupId != bytes32(0), "Backup ID cannot be zero");

        // Access control: user is always msg.sender, preventing others from overwriting your backup
        address user = msg.sender;
        uint256 timestamp = block.timestamp;

        latestBackups[user] = BackupEntry({backupId: backupId, ipfsHash: ipfsHash, timestamp: timestamp});

        emit BackupSubmitted(user, backupId, ipfsHash, timestamp);
    }

    /**
     * @notice Get backup for a specific user and backup ID
     * @param user Address of the user
     * @param backupId Backup ID (bytes32)
     * @return ipfsHash IPFS hash of the backup
     * @return timestamp Timestamp when the backup was submitted
     */
    function getBackup(address user, bytes32 backupId)
        external
        view
        returns (string memory ipfsHash, uint256 timestamp)
    {
        BackupEntry storage entry = latestBackups[user];
        if (entry.backupId == backupId && backupId != bytes32(0)) {
            return (entry.ipfsHash, entry.timestamp);
        }
        return ("", 0);
    }

    /**
     * @notice Get the latest backup for a specific user
     * @param user Address of the user
     * @return backupId Latest backup ID
     * @return ipfsHash Latest IPFS hash
     * @return timestamp Latest submission timestamp
     */
    function getLatestBackup(address user)
        external
        view
        returns (bytes32 backupId, string memory ipfsHash, uint256 timestamp)
    {
        BackupEntry storage entry = latestBackups[user];
        return (entry.backupId, entry.ipfsHash, entry.timestamp);
    }

    /**
     * @notice Get all backup IDs for a user
     * @param user Address of the user
     * @return Array of backup IDs (bytes32)
     */
    function getUserBackupIds(address user) external view returns (bytes32[] memory) {
        BackupEntry storage entry = latestBackups[user];
        if (entry.backupId == bytes32(0)) {
            return new bytes32[](0);
        }
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = entry.backupId;
        return ids;
    }

    /**
     * @notice Get the number of backups for a user
     * @param user Address of the user
     * @return Number of backups
     */
    function getUserBackupCount(address user) external view returns (uint256) {
        return latestBackups[user].backupId == bytes32(0) ? 0 : 1;
    }
}
