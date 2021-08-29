// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface ITokenFactory {
    event SetBaseURI721(string uri);
    event SetBaseURI1155(string uri);
    event SetProtocolFeeRecipient(address recipient);
    event SetOperationalFee(uint8 fee);
    event SetOperationalFeeRecipient(address recipient);
    event SetDeployerWhitelisted(address deployer, bool whitelisted);
    event SetStrategyWhitelisted(address strategy, bool whitelisted);
    event UpgradeNFT721(address newTarget);
    event UpgradeNFT1155(address newTarget);
    event UpgradeSocialToken(address newTarget);
    event UpgradeERC721Exchange(address exchange);
    event UpgradeERC1155Exchange(address exchange);
    event DeployNFT721AndMintBatch(
        address indexed proxy,
        address indexed owner,
        string name,
        string symbol,
        uint256[] tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event DeployNFT721AndPark(
        address indexed proxy,
        address indexed owner,
        string name,
        string symbol,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event DeployNFT1155AndMintBatch(
        address indexed proxy,
        address indexed owner,
        uint256[] tokenIds,
        uint256[] amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event DeploySocialToken(
        address indexed proxy,
        address indexed owner,
        string name,
        string symbol,
        address indexed dividendToken,
        uint256 initialSupply
    );

    function MAX_ROYALTY_FEE() external view returns (uint8);

    function MAX_OPERATIONAL_FEE() external view returns (uint8);

    function PARK_TOKEN_IDS_721_TYPEHASH() external view returns (bytes32);

    function MINT_BATCH_721_TYPEHASH() external view returns (bytes32);

    function MINT_BATCH_1155_TYPEHASH() external view returns (bytes32);

    function MINT_SOCIAL_TOKEN_TYPEHASH() external view returns (bytes32);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function nonces(address account) external view returns (uint256);

    function baseURI721() external view returns (string memory);

    function baseURI1155() external view returns (string memory);

    function erc721Exchange() external view returns (address);

    function erc1155Exchange() external view returns (address);

    function protocolFeeInfo() external view returns (address recipient, uint8 permil);

    function operationalFeeInfo() external view returns (address recipient, uint8 permil);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function isDeployerWhitelisted(address strategy) external view returns (bool);

    function setBaseURI721(string memory uri) external;

    function setBaseURI1155(string memory uri) external;

    function setProtocolFeeRecipient(address protocolFeeRecipient) external;

    function setOperationalFeeRecipient(address operationalFeeRecipient) external;

    function setOperationalFee(uint8 operationalFee) external;

    function setDeployerWhitelisted(address deployer, bool whitelisted) external;

    function setStrategyWhitelisted(address strategy, bool whitelisted) external;

    function upgradeNFT721(address newTarget) external;

    function upgradeNFT1155(address newTarget) external;

    function upgradeSocialToken(address newTarget) external;

    function upgradeERC721Exchange(address exchange) external;

    function upgradeERC1155Exchange(address exchange) external;

    function deployNFT721AndMintBatch(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256[] calldata tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function deployNFT721AndPark(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function isNFT721(address query) external view returns (bool result);

    function deployNFT1155AndMintBatch(
        address owner,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function isNFT1155(address query) external view returns (bool result);

    function deploySocialToken(
        address owner,
        string memory name,
        string memory symbol,
        address dividendToken,
        uint256 initialSupply
    ) external returns (address proxy);

    function isSocialToken(address query) external view returns (bool result);

    function parkTokenIds721(
        address nft,
        uint256 toTokenId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function mintBatch721(
        address nft,
        address to,
        uint256[] calldata tokenIds,
        bytes calldata data,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function mintBatch1155(
        address nft,
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function mintSocialToken(
        address token,
        address to,
        uint256 amount,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
