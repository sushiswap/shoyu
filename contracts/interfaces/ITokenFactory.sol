// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface ITokenFactory {
    event UpgradeNFT721(address newTarget);
    event UpgradeNFT1155(address newTarget);
    event UpgradeSocialToken(address newTarget);
    event UpgradeERC721Exchange(address exchange);
    event UpgradeERC1155Exchange(address exchange);
    event DeployNFT721(
        address indexed proxy,
        address indexed owner,
        string name,
        string symbol,
        uint256[] tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event DeployNFT721(
        address indexed proxy,
        address indexed owner,
        string name,
        string symbol,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event DeployNFT1155(
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
        address indexed dividendToken
    );
    event Tag(address indexed nft, uint256 indexed tokenId, string indexed tag, uint256 tagNonce);

    function MAX_ROYALTY_FEE() external view returns (uint8);

    function MAX_OPERATIONAL_FEE() external view returns (uint8);

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

    function deployNFT721(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256[] calldata tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function deployNFT721(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function isNFT721(address query) external view returns (bool result);

    function deployNFT1155(
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
        address dividendToken
    ) external returns (address proxy);

    function isSocialToken(address query) external view returns (bool result);

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        bytes calldata data,
        string[] calldata tags
    ) external;

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data,
        string[] calldata tags
    ) external;

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] calldata tags
    ) external;

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] calldata tags
    ) external;
}
